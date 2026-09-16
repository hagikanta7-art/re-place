import { useCallback, useEffect, useState } from 'react';
import { View, Text, Switch, TouchableOpacity, AppState, Linking, ScrollView, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { getNotificationBodyVisible, setNotificationBodyVisible } from '../core/prefs';
import { getGeofenceStatus, getGeofenceLog, clearGeofenceLog } from '../core/geofence';
import { colors, spacing, radius } from '../core/theme';

function formatTime(iso) {
  if (!iso) return '未登録';
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}更新`;
}

function formatLogTime(iso) {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

// ⑦設定。D担当。許可状況の表示と、通知本文表示のON/OFFのみのシンプルな画面。
export default function SettingsScreen() {
  const [notifStatus, setNotifStatus] = useState('確認中...');
  const [locationStatus, setLocationStatus] = useState('確認中...');
  const [locationGranted, setLocationGranted] = useState(true);
  const [bodyVisible, setBodyVisible] = useState(true);
  const [geofenceStatus, setGeofenceStatus] = useState({ isActive: false, count: null, updatedAt: null });
  const [log, setLog] = useState([]);

  const refreshLog = useCallback(async () => {
    setLog(await getGeofenceLog());
  }, []);

  const handleClearLog = async () => {
    await clearGeofenceLog();
    setLog([]);
  };

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

    setGeofenceStatus(await getGeofenceStatus());
    await refreshLog();
  }, [refreshLog]);

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
    <ScrollView style={styles.container} contentContainerStyle={styles.containerContent}>
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

      <View style={styles.row}>
        <Text style={styles.label}>ジオフェンス監視</Text>
        <Text
          style={[styles.value, !geofenceStatus.isActive && styles.valueWarning]}
        >
          {geofenceStatus.isActive ? '有効' : '停止中'}
        </Text>
      </View>
      <Text style={styles.subNote}>
        {geofenceStatus.count != null
          ? `${geofenceStatus.count}件のスポットを監視中（${formatTime(geofenceStatus.updatedAt)}）`
          : 'まだ場所が登録されていません'}
      </Text>
      <TouchableOpacity style={styles.refreshButton} onPress={refreshPermissions}>
        <Text style={styles.refreshButtonText}>状態を再確認</Text>
      </TouchableOpacity>

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
      <Text style={styles.note}>
        「ジオフェンス監視」が停止中、または件数が0のまま変わらない場合は、位置トリガー通知は動きません。場所を登録し直すか、このアプリを一度開き直してから「状態を再確認」を押してください。
      </Text>

      <View style={styles.logHeader}>
        <Text style={styles.logTitle}>診断ログ</Text>
        <TouchableOpacity onPress={handleClearLog}>
          <Text style={styles.logClear}>クリア</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.note}>
        位置トリガーが反応しなかったとき、原因を確認するための記録です。「🔔タスク発火」が一度も出ていなければOS側で監視自体が呼び出されていません（電池最適化・権限を疑ってください）。「⏸クールダウン中」が出ていれば、直近にすでに通知済みのため意図的にスキップされたものです。
      </Text>
      {log.length === 0 ? (
        <Text style={styles.logEmpty}>まだ記録がありません</Text>
      ) : (
        log.map((entry, i) => (
          <Text key={i} style={styles.logEntry}>
            {formatLogTime(entry.at)}　{entry.message}
          </Text>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  containerContent: { padding: spacing.md, paddingBottom: spacing.lg * 2 },
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
  subNote: { color: colors.textFaint, fontSize: 12, marginTop: -4, marginBottom: spacing.xs },
  refreshButton: { alignSelf: 'flex-start', paddingVertical: 4 },
  refreshButtonText: { color: colors.primary, fontSize: 12 },
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
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  logTitle: { fontSize: 15, fontWeight: 'bold', color: colors.text },
  logClear: { color: colors.danger, fontSize: 12 },
  logEmpty: { color: colors.textFaint, fontSize: 12, marginTop: spacing.sm },
  logEntry: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 6,
    fontFamily: 'monospace',
  },
});
