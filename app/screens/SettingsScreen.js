import { useEffect, useState } from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { getNotificationBodyVisible, setNotificationBodyVisible } from '../core/prefs';

// ⑦設定。D担当。許可状況の表示と、通知本文表示のON/OFFのみのシンプルな画面。
export default function SettingsScreen() {
  const [notifStatus, setNotifStatus] = useState('確認中...');
  const [locationStatus, setLocationStatus] = useState('確認中...');
  const [bodyVisible, setBodyVisible] = useState(true);

  useEffect(() => {
    (async () => {
      const notif = await Notifications.getPermissionsAsync();
      setNotifStatus(notif.status === 'granted' ? '許可済み' : '未許可');

      const fg = await Location.getForegroundPermissionsAsync();
      const bg = await Location.getBackgroundPermissionsAsync();
      if (bg.status === 'granted') setLocationStatus('常に許可');
      else if (fg.status === 'granted') setLocationStatus('使用中のみ許可');
      else setLocationStatus('未許可');

      setBodyVisible(await getNotificationBodyVisible());
    })();
  }, []);

  const handleToggleBodyVisible = async (value) => {
    setBodyVisible(value);
    await setNotificationBodyVisible(value);
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>通知の許可状況</Text>
        <Text style={styles.value}>{notifStatus}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>位置情報の許可状況</Text>
        <Text style={styles.value}>{locationStatus}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>通知本文の表示</Text>
        <Switch value={bodyVisible} onValueChange={handleToggleBodyVisible} />
      </View>
      <Text style={styles.note}>
        「常に許可」になっていない場合、端末の設定アプリからこのアプリの位置情報の権限を変更してください。
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  label: { fontSize: 15 },
  value: { color: '#2f6fed', fontWeight: 'bold' },
  note: { marginTop: 16, color: '#999', fontSize: 12 },
});
