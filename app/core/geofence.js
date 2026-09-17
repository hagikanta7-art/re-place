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
// OSのジオフェンシング(startGeofencingAsync)は省電力のため、バックグラウンドでは
// 位置情報の更新頻度が大きく落とされ、Enter/Exitの判定が大幅に遅延することがある。
// これを補うため、フォアグラウンドサービスで位置情報を継続的に取得し続け、
// 自前で圏内/圏外を判定するタスクを別途用意する（常時通知アイコンが出る代わりに、
// 画面オフ・バックグラウンドでも確実に検知できるようにするため）。
export const LOCATION_TASK = 'mykarte-location-task';
export const DEFAULT_GEOFENCE_RADIUS_METERS = 120;

// 同じ場所に居座っている間、境界の出入りで何度も通知が来ないようにするための
// 「今、圏内にいるかどうか」の状態管理。
// 以前は時間ベースのクールダウン（10分）だったが、それだと「圏内にいる間ずっと
// 通知が来ない/来る」の境目が分かりにくく、また本当に一度出て戻ってきた場合でも
// 10分経っていないと通知が来ない、という不便があった。
// 今は「圏外→圏内」に切り替わった瞬間だけ通知し、圏内にいる間は再通知しない。
// 圏外に出た（Exitイベント）ら状態をリセットし、次に圏内に入ったらまた通知する。
const insideStateKey = (spotId) => `geofence:inside:${spotId}`;

async function isMarkedInside(spotId) {
  const raw = await AsyncStorage.getItem(insideStateKey(spotId));
  return raw === '1';
}

async function setInsideState(spotId, inside) {
  await AsyncStorage.setItem(insideStateKey(spotId), inside ? '1' : '0');
}

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

// フォアグラウンドサービスの位置追跡タスク（LOCATION_TASK）は、Firestoreに
// アクセスせずに圏内判定できるよう、登録済みスポットの座標一覧をAsyncStorageに
// キャッシュしておく（registerGeofences() のたびに更新）。
const GEOFENCE_REGIONS_KEY = 'geofence:regions';

async function saveRegions(regions) {
  await AsyncStorage.setItem(GEOFENCE_REGIONS_KEY, JSON.stringify(regions));
}

async function loadRegions() {
  const raw = await AsyncStorage.getItem(GEOFENCE_REGIONS_KEY);
  return raw ? JSON.parse(raw) : [];
}

// ⑦設定画面から呼び出す診断用関数。フォアグラウンドサービスによる
// 継続的な位置追跡タスクが起動しているかを確認する。
export async function getLocationTrackingStatus() {
  const isActive = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  return { isActive };
}

// 通知の中身（場所名・前回のメモ）を組み立てるのに必要な最小限の情報を
// AsyncStorageにキャッシュしておく。以前は handleSpotEnter() が毎回
// Firestoreへライブアクセスしていたが、バックグラウンドの短い実行時間内に
// ネットワーク応答が間に合わず、通知そのものが送られない（タスクが黙って
// 終了する）ことがあった。圏内判定はすでにキャッシュ（geofence:regions）で
// 完結しているのに、通知本文の組み立てだけネットワークに依存しているのは
// 中途半端だったため、こちらもキャッシュ経由に揃える。
// registerGeofences() が実行されるたび（＝アプリが前面にありFirestoreと
// 同期できているとき）に更新される。
const GEOFENCE_SPOT_CACHE_KEY = 'geofence:spotSummaries';

async function saveSpotSummaries(spots) {
  const summaries = {};
  for (const spot of spots) {
    const last = latestVisit(spot);
    summaries[spot.id] = {
      id: spot.id,
      name: spot.name,
      notifyEnabled: spot.notifyEnabled,
      goodPoint: last?.goodPoint || '',
      caution: last?.caution || '',
      visitsCount: (spot.visits || []).length,
    };
  }
  await AsyncStorage.setItem(GEOFENCE_SPOT_CACHE_KEY, JSON.stringify(summaries));
}

async function getCachedSpotSummary(spotId) {
  const raw = await AsyncStorage.getItem(GEOFENCE_SPOT_CACHE_KEY);
  const summaries = raw ? JSON.parse(raw) : {};
  return summaries[spotId] || null;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // shouldShowAlert は非推奨（expo-notifications 57で shouldShowBanner /
    // shouldShowList に分離された）。これを設定していなかったため、通知の
    // 作成自体は成功していても実際には表示されていなかった可能性が高い。
    shouldShowBanner: true, // 画面上部にバナー表示（旧shouldShowAlert相当）
    shouldShowList: true, // 通知一覧・ステータスバーに残す
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
  if (await isMarkedInside(spotId)) {
    await appendLog(`⏸ すでに圏内にいるため通知をスキップ (${cause}): ${spotId}`);
    return;
  }
  // 圏外→圏内に切り替わったことを先に記録する（この後の判定で通知しない場合でも、
  // 「今は圏内にいる」という物理的な事実は変わらないため）
  await setInsideState(spotId, true);

  // 通知本文の組み立ては、まずローカルキャッシュから読む（ネットワーク不要）。
  // キャッシュに無い場合（キャッシュがまだ作られる前など）だけ、フォールバックとして
  // Firestoreへライブアクセスする。
  let spot = await getCachedSpotSummary(spotId);
  let fromCache = true;
  if (!spot) {
    fromCache = false;
    try {
      const live = await getSpot(spotId);
      if (live) {
        const last = latestVisit(live);
        spot = {
          id: live.id,
          name: live.name,
          notifyEnabled: live.notifyEnabled,
          goodPoint: last?.goodPoint || '',
          caution: last?.caution || '',
          visitsCount: (live.visits || []).length,
        };
      }
    } catch (e) {
      await appendLog(`⚠ フォールバックのFirestore取得に失敗 (${cause}): ${e.message || e}`);
    }
  }

  if (!spot) {
    await appendLog(`❌ スポットが見つからない (${cause}): ${spotId}`);
    return;
  }
  if (spot.notifyEnabled === false) {
    await appendLog(`⏸ 通知OFF設定のためスキップ (${cause}): ${spot.name}`);
    return;
  }

  const permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted') {
    await appendLog(`⚠ 通知の許可がありません（status=${permission.status}）。表示されない可能性があります`);
  }

  const showBody = await getNotificationBodyVisible();

  let body = '記録があります。開いて確認してください。';
  if (showBody) {
    const lines = [];
    if (spot.goodPoint) lines.push(`◎ ${spot.goodPoint}`);
    if (spot.caution) lines.push(`⚠ ${spot.caution}`);
    // 強み1（蓄積型タイムライン）: 記録が複数回あることが伝わるようにする
    if (spot.visitsCount >= 2) lines.push(`📚 これまでに${spot.visitsCount}回の記録があります`);
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

  await appendLog(`✅ 通知を送信 (${cause}${fromCache ? '' : '・Firestoreへフォールバック'}): ${spot.name}`);
}

// 圏外に出た（Exitイベント）ときの処理。通知は出さず、「圏内にいる」状態だけ
// リセットする。これにより、次に圏内に入ったときにまた通知できるようになる。
async function handleSpotExit(spotId, cause) {
  await setInsideState(spotId, false);
  await appendLog(`🚪 圏外に出た (${cause}): ${spotId}`);
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

  try {
    if (eventType === Location.GeofencingEventType.Enter) {
      await handleSpotEnter(region.identifier, 'OS Enterイベント');
    } else if (eventType === Location.GeofencingEventType.Exit) {
      await handleSpotExit(region.identifier, 'OS Exitイベント');
    } else {
      await appendLog('（Enter/Exit以外のイベントのためスキップ）');
    }
  } catch (e) {
    await appendLog(`❌ 例外発生: ${e.message || e}`);
  }
});

// フォアグラウンドサービスから継続的に届く位置情報をもとに、自前で圏内/圏外の
// 切り替わりを判定する（distanceMeters は下で定義しているが、関数宣言は
// 巻き上げられるためここから参照できる）。ログが位置更新のたびに大量に出ないよう、
// 「状態が変化したとき」だけ handleSpotEnter/handleSpotExit を呼ぶ。
async function handleLocationSample(region, lat, lng) {
  const distance = distanceMeters(lat, lng, region.latitude, region.longitude);
  const inside = distance <= region.radius;
  const wasInside = await isMarkedInside(region.identifier);
  if (inside && !wasInside) {
    await handleSpotEnter(region.identifier, '継続位置追跡');
  } else if (!inside && wasInside) {
    await handleSpotExit(region.identifier, '継続位置追跡');
  }
}

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    await appendLog(`❌ 位置追跡タスクエラー: ${error.message || error}`);
    return;
  }
  const locations = data?.locations;
  const latest = Array.isArray(locations) ? locations[locations.length - 1] : null;
  if (!latest) return;

  try {
    const regions = await loadRegions();
    for (const region of regions) {
      await handleLocationSample(region, latest.coords.latitude, latest.coords.longitude);
    }
  } catch (e) {
    await appendLog(`❌ 位置追跡タスクで例外発生: ${e.message || e}`);
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

// フォアグラウンドサービスによる継続的な位置追跡を開始する。
// 常時表示の通知アイコンが出る代わりに、バッテリー最適化の影響を受けずに
// 位置情報を取得し続けられる（Must機能の信頼性を上げるためのトレードオフ）。
async function startLocationTracking() {
  const already = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  if (already) return;
  try {
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 30 * 1000, // 30秒ごと
      distanceInterval: 20, // 20m動くごと
      foregroundService: {
        notificationTitle: 'Re:Place',
        notificationBody: '登録した場所への到着を検知しています',
        killServiceOnDestroy: false,
      },
    });
    await appendLog('📡 位置追跡（フォアグラウンドサービス）を開始');
  } catch (e) {
    await appendLog(`❌ 位置追跡の開始に失敗: ${e.message || e}`);
  }
}

async function stopLocationTracking() {
  const already = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  if (!already) return;
  await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  await appendLog('📡 位置追跡（フォアグラウンドサービス）を停止');
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
      // Exitイベントも受け取り、「圏内にいる」状態をリセットするために使う
      // （次に圏内へ入ったときにまた通知できるようにするため）
      notifyOnExit: true,
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
    await saveRegions(regions);
    await saveSpotSummaries(spots);
    await appendLog(`📍 ジオフェンス登録: ${regions.length}件`);

    if (regions.length > 0) {
      await checkAlreadyInside(regions);
      await startLocationTracking();
    } else {
      await stopLocationTracking();
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
