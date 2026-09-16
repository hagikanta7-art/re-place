// 端末ローカルの表示設定（Firestoreではなく AsyncStorage に保存する）。
// 例: 通知本文の表示ON/OFF（⑦設定画面で切り替える想定）。
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATION_BODY_VISIBLE_KEY = 'pref:notificationBodyVisible';

export async function getNotificationBodyVisible() {
  const value = await AsyncStorage.getItem(NOTIFICATION_BODY_VISIBLE_KEY);
  return value === null ? true : value === 'true'; // デフォルトON
}

export async function setNotificationBodyVisible(visible) {
  await AsyncStorage.setItem(NOTIFICATION_BODY_VISIBLE_KEY, String(visible));
}
