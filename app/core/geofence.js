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
import { getSpot, latestVisit } from './spots';
import { getNotificationBodyVisible } from './prefs';

export const GEOFENCE_TASK = 'mykarte-geofence-task';
export const DEFAULT_GEOFENCE_RADIUS_METERS = 120;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
  if (error) {
    console.log('geofence task error', error);
    return;
  }
  if (!data) return;
  const { eventType, region } = data;
  if (eventType !== Location.GeofencingEventType.Enter) return;

  try {
    const spot = await getSpot(region.identifier);
    if (!spot || spot.notifyEnabled === false) return;

    const last = latestVisit(spot);
    const showBody = await getNotificationBodyVisible();

    let body = '記録があります。開いて確認してください。';
    if (showBody && last) {
      const lines = [];
      if (last.goodPoint) lines.push(`◎ ${last.goodPoint}`);
      if (last.caution) lines.push(`⚠ ${last.caution}`);
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
  } catch (e) {
    console.log('geofence task failed', e);
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
  } catch (e) {
    console.log('geofence registration failed', e);
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
