import { useCallback, useEffect, useState } from 'react';
import { View, Text, Switch, TouchableOpacity, AppState, Linking, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { getNotificationBodyVisible, setNotificationBodyVisible } from '../core/prefs';
import { colors, spacing, radius } from '../core/theme';

// ⑦設定。D担当。許可状況の表示と、通知本文表示のON/OFFのみのシンプルな画面。
export default function SettingsScreen() {
  const [notifStatus, setNotifStatus] = useState('確認中...');
  const [locationStatus, setLocationStatus] = useState('確認中...');
  const [locationGranted, setLocationGranted] = useState(true);
  const [bodyVisible, setBodyVisible] = useState(true);

  const refreshPermissions = useCallback(async () => {
    const notif = await Notifications.getPermissionsAsync();
    setNotifStatus(notif.status === 'granted' ? '許可済み' : '未許可');

    const fg = await Location.getForegroundPermissionsAsync();
    const bg = await Location.getBackgroundPermissionsAsync();
    if (bg.status === 'granted') {
      setLocationStatus('常に許可');
      setLocationGranted(true);
    } else if (fg.status === 'granted') {
      setLocationStatus('使用中のみ許可（アプリを閉じると通知が届きません）');
      setLocationGranted(false);
    } else {
      setLocationStatus('未許可');
      setLocationGranted(false);
    }
  }, []);

  useEffect(() => {
    refreshPermissions();
    getNotificationBodyVisible().then(setBodyVisible);

    // 端末の設定アプリで権限を変更して戻ってきたときに反映させる
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshPermissions();
    });
    return () => sub.remove();
  }, [refreshPermissions]);

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
        <Text style={[styles.value, !locationGranted && styles.valueWarning]}>
          {locationStatus}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>通知本文の表示</Text>
        <Switch value={bodyVisible} onValueChange={handleToggleBodyVisible} />
      </View>

      {!locationGranted && (
        <TouchableOpacity style={styles.settingsButton} onPress={() => Linking.openSettings()}>
          <Text style={styles.settingsButtonText}>端末の設定を開く</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.note}>
        「常に許可」になっていない場合、アプリを閉じている間は位置トリガー通知が届きません。上のボタンから設定アプリを開き、位置情報を「常に許可」に変更してください。
      </Text>
      <Text style={styles.note}>
        「通知本文の表示」をOFFにすると、通知に「良かったこと」「注意点」の内容を表示せず、記録がある旨だけをお知らせします（ロック画面等で内容を見られたくない場合に）。
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: { fontSize: 15, color: colors.text },
  value: { color: colors.primary, fontWeight: 'bold' },
  valueWarning: { color: colors.danger },
  settingsButton: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  settingsButtonText: { color: colors.primary, fontWeight: 'bold' },
  note: { marginTop: spacing.md, color: colors.textFaint, fontSize: 12, lineHeight: 18 },
});
