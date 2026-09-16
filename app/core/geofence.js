// 位置トリガー通知の中核（Must機能）。
// - このファイルは import された瞬間に TaskManager.defineTask を実行するため、
//   必ずアプリのエントリーポイント（App.js の一番上）で import すること。
//   そうしないと、アプリが完全に終了した状態からOSに呼び起こされた際に
//   タスクが登録されておらず、通知が発火しない。
// - 通知データ（content.data）に spotId を積んでおくことで、通知タップ時に
//   「④場所のカルテ」へ遷移できるようにしている（attachNotificationResponseHandler）。

import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSpot, latestVisit } from './spots';
import { getNotificationBodyVisible } from './prefs';

export const GEOFENCE_TASK = 'mykarte-geofence-task';
export const DEFAULT_GEOFENCE_RADIUS_METERS = 120;

// 同じ場所に居座っている間、境界の出入りで何度も通知が来ないようにするクールダウン。
// （境界付近を行ったり来たりするとEnterイベントが連発することがあるため）
// ※テスト段階では短めにしておく。デモ本番が近づいたら伸ばすことを検討。
const NOTIFY_COOLDOWN_MS = 10 * 60 * 1000; // 10分
const lastNotifiedKey = (spotId) => `geofence:lastNotified:${spotId}`;

// 「タスクが発火したが、なぜ通知を出さなかったか／出せなかったか」を記録する診断ログ。
// 実機を持ち帰らなくても⑦設定画面から原因を確認できるようにするためのもの。
const GEOFENCE_LOG_KEY = 'geofence:log';
const MAX_LOG_ENTRIES = 30;

async function appendLog(message) {
  try {
    const raw = await AsyncStorage.getItem(GEOFENCE_LOG_KEY);
    const log = raw ? JSON.parse(raw) : [];
    log.unshift({ message, at: new Date().toISOString() });
    await AsyncStorage.setItem(GEOFENCE_LOG_KEY, JSON.stringify(log.slice(0, MAX_LOG_ENTRIES)));
  } catch (e) {
    // ログ自体の失敗は握りつぶす（本来の通知処理を止めないため）
  }
}

export async function getGeofenceLog() {
  const raw = await AsyncStorage.getItem(GEOFENCE_LOG_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function clearGeofenceLog() {
  await AsyncStorage.removeItem(GEOFENCE_LOG_KEY);
}

async function isWithinCooldown(spotId) {
  const raw = await AsyncStorage.getItem(lastNotifiedKey(spotId));
  if (!raw) return false;
  const last = Number(raw);
  return Date.now() - last < NOTIFY_COOLDOWN_MS;
}

async function markNotified(spotId) {
  await AsyncStorage.setItem(lastNotifiedKey(spotId), String(Date.now()));
}

// 「本当にジオフェンス登録が動いたか」を⑦設定画面で確認できるようにするための記録。
// expo-locationには登録件数を直接問い合わせるAPIがないため、
// registerGeofences() が実行されるたびに自分で記録しておく。
const GEOFENCE_META_KEY = 'geofence:meta';

async function saveGeofenceMeta(count) {
  await AsyncStorage.setItem(
    GEOFENCE_META_KEY,
    JSON.stringify({ count, updatedAt: new Date().toISOString() })
  );
}

// ⑦設定画面から呼び出す診断用関数。
// isActive: OSにジオフェンスタスクが登録されているか
// count/updatedAt: 最後に registerGeofences() が何件登録したか、いつ登録したか
export async function getGeofenceStatus() {
  const isActive = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
  const raw = await AsyncStorage.getItem(GEOFENCE_META_KEY);
  const meta = raw ? JSON.parse(raw) : { count: null, updatedAt: null };
  return { isActive, ...meta };
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Android 8+は通知チャンネルの設定が振動・重要度・ロック画面表示を左右する。
// 明示的に作っておかないと機種・OSバージョンによってバイブレーションが鳴らないことがあるため、
// 「画面が暗い状態でも確実に気づける」ようにHIGH importance + バイブレーションパターンを指定する。
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: '位置トリガー通知',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    sound: 'default',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

// Enter判定が下されたスポットに対して、実際に通知を組み立てて送る共通処理。
// バックグラウンドタスクからの呼び出しと、登録直後の「すでに圏内」チェックの
// 両方から使う（cause は診断ログ用のラベル）。
async function handleSpotEnter(spotId, cause) {
  if (await isWithinCooldown(spotId)) {
    await appendLog(`⏸ クールダウン中のためスキップ (${cause}): ${spotId}`);
    return;
  }

  const spot = await getSpot(spotId);
  if (!spot) {
    await appendLog(`❌ スポットが見つからない (${cause}): ${spotId}`);
    return;
  }
  if (spot.notifyEnabled === false) {
    await appendLog(`⏸ 通知OFF設定のためスキップ (${cause}): ${spot.name}`);
    return;
  }

  const visits = spot.visits || [];
  const last = latestVisit(spot);
  const showBody = await getNotificationBodyVisible();

  let body = '記録があります。開いて確認してください。';
  if (showBody && last) {
    const lines = [];
    if (last.goodPoint) lines.push(`◎ ${last.goodPoint}`);
    if (last.caution) lines.push(`⚠ ${last.caution}`);
    // 強み1（蓄積型タイムライン）: 記録が複数回あることが伝わるようにする
    if (visits.length >= 2) lines.push(`📚 これまでに${visits.length}回の記録があります`);
    if (lines.length > 0) body = lines.join('\n');
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `前回のあなたからのメモ（${spot.name}）`,
      body,
      data: { spotId: spot.id },
      channelId: 'default', // 上で設定した、振動・重要度つきのチャンネルを明示的に使う
    },
    trigger: null,
  });

  await markNotified(spotId);
  await appendLog(`✅ 通知を送信 (${cause}): ${spot.name}`);
}

TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
  if (error) {
    await appendLog(`❌ タスクエラー: ${error.message || error}`);
    return;
  }
  if (!data) {
    await appendLog('⚠ タスクは発火したがdataが空');
    return;
  }
  const { eventType, region } = data;
  await appendLog(
    `🔔 タスク発火: eventType=${eventType} identifier=${region?.identifier}`
  );
  if (eventType !== Location.GeofencingEventType.Enter) {
    await appendLog('（Enterイベントではないためスキップ）');
    return;
  }

  try {
    await handleSpotEnter(region.identifier, 'OS Enterイベント');
  } catch (e) {
    await appendLog(`❌ 例外発生: ${e.message || e}`);
  }
});

// 地球上の2点間の距離（メートル）。Haversine公式。
function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ジオフェンスは「登録した瞬間すでに圏内にいる」場合、その後Enterが正しく
// 発火しないことがある（既知の癖）。登録直後に現在地を確認し、
// すでに半径内のスポットがあればその場でEnter相当の処理をしてしまうことで、
// 圏内から動かない・微妙なGPS誤差でズレている、といったケースを救う。
async function checkAlreadyInside(regions) {
  try {
    const position = await Location.getCurrentPositionAsync({});
    const { latitude, longitude } = position.coords;
    for (const region of regions) {
      const d = distanceMeters(latitude, longitude, region.latitude, region.longitude);
      if (d <= region.radius) {
        await appendLog(
          `📍 登録時点ですでに圏内と判定: ${region.identifier}（距離${Math.round(d)}m）`
        );
        await handleSpotEnter(region.identifier, '登録時チェック');
      }
    }
  } catch (e) {
    await appendLog(`⚠ 登録時の現在地チェックに失敗: ${e.message || e}`);
  }
}

// 指定したspots一覧に基づいて、ジオフェンスの登録をまるごと張り替える。
// notifyEnabled=false のスポットは監視対象から除外する。
export async function registerGeofences(spots) {
  const regions = spots
    .filter((s) => s.notifyEnabled !== false)
    .filter((s) => typeof s.lat === 'number' && typeof s.lng === 'number')
    .map((s) => ({
      identifier: s.id,
      latitude: s.lat,
      longitude: s.lng,
      radius: s.geofenceRadius || DEFAULT_GEOFENCE_RADIUS_METERS,
      notifyOnEnter: true,
      notifyOnExit: false,
    }));

  try {
    const already = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
    if (already) {
      await Location.stopGeofencingAsync(GEOFENCE_TASK);
    }
    if (regions.length > 0) {
      await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
    }
    await saveGeofenceMeta(regions.length);
    await appendLog(`📍 ジオフェンス登録: ${regions.length}件`);

    if (regions.length > 0) {
      await checkAlreadyInside(regions);
    }
  } catch (e) {
    await saveGeofenceMeta(0);
    await appendLog(`❌ ジオフェンス登録に失敗: ${e.message || e}`);
  }
}

// 通知をタップしたときに ④場所のカルテ (SpotDetail) へ遷移させる。
// App.js から一度だけ呼び出す。navigationRef は @react-navigation の ref。
export function attachNotificationResponseHandler(navigationRef) {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const spotId = response.notification.request.content.data?.spotId;
    if (spotId && navigationRef.current?.isReady()) {
      navigationRef.current.navigate('SpotDetail', { spotId });
    }
  });
  return () => subscription.remove();
}
