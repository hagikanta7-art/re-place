// 位置トリガー通知の中核（Must機能）。
// - このファイルは import された瞬間に TaskManager.defineTask を実行するため、
//   必ずアプリのエントリーポイント（App.js の一番上）で import すること。
//   そうしないと、アプリが完全に終了した状態からOSに呼び起こされた際に
//   タスクが登録されておらず、通知が発火しない。
// - 通知データ（content.data）に spotId を積んでおくことで、通知タップ時に
//   「④場所のカルテ」へ遷移できるようにしている（attachNotificationResponseHandler）。

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
    const spotId = region.identifier;
    if (await isWithinCooldown(spotId)) {
      await appendLog(`⏸ クールダウン中のためスキップ: ${spotId}`);
      return;
    }

    const spot = await getSpot(spotId);
    if (!spot) {
      await appendLog(`❌ スポットが見つからない: ${spotId}`);
      return;
    }
    if (spot.notifyEnabled === false) {
      await appendLog(`⏸ 通知OFF設定のためスキップ: ${spot.name}`);
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
      },
      trigger: null,
    });

    await markNotified(spotId);
    await appendLog(`✅ 通知を送信: ${spot.name}`);
  } catch (e) {
    await appendLog(`❌ 例外発生: ${e.message || e}`);
  }
});

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
