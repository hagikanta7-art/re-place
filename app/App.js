import { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  doc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, waitForAuth } from './firebase';
import MapPicker from './MapPicker';

// 地図モーダルを開くときの初期中心座標（現在地取得に失敗した場合のフォールバック: 東京駅）
const DEFAULT_CENTER = { lat: 35.681236, lng: 139.767125 };

const GEOFENCE_TASK = 'mykarte-geofence-task';
const GEOFENCE_RADIUS_METERS = 120;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// トップレベルで定義することで、アプリが完全に終了していてもOSから呼び出される
TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
  if (error) {
    console.log('geofence task error', error);
    return;
  }
  if (!data) return;
  const { eventType, region } = data;
  if (eventType !== Location.GeofencingEventType.Enter) return;

  try {
    await waitForAuth();
    const snap = await getDoc(doc(db, 'spots', region.identifier));
    if (!snap.exists()) return;
    const spot = snap.data();
    const visits = spot.visits || [];
    const last = visits[visits.length - 1];
    if (!last) return;

    const bodyLines = [];
    if (last.goodPoint) bodyLines.push(`◎ ${last.goodPoint}`);
    if (last.caution) bodyLines.push(`⚠ ${last.caution}`);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `前回のあなたからのメモ（${spot.name}）`,
        body: bodyLines.join('\n') || '記録があります',
      },
      trigger: null,
    });
  } catch (e) {
    console.log('geofence task failed', e);
  }
});

export default function App() {
  const [ready, setReady] = useState(false);
  const [uid, setUid] = useState(null);
  const [spots, setSpots] = useState([]);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('飲食');
  const [goodPoint, setGoodPoint] = useState('');
  const [caution, setCaution] = useState('');
  const [saving, setSaving] = useState(false);
  const [location, setLocation] = useState(null); // { lat, lng }
  const [mapVisible, setMapVisible] = useState(false);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);

  // 起動時: サインイン → 位置情報の許可 → 通知の許可
  useEffect(() => {
    (async () => {
      try {
        const user = await waitForAuth();
        setUid(user.uid);

        const fg = await Location.requestForegroundPermissionsAsync();
        if (fg.status !== 'granted') {
          Alert.alert('位置情報の許可が必要です', '設定から「位置情報」を許可してください。');
          return;
        }
        const bg = await Location.requestBackgroundPermissionsAsync();
        if (bg.status !== 'granted') {
          Alert.alert(
            '「常に許可」が必要です',
            'アプリを閉じていても通知するには、設定から位置情報を「常に許可」に変更してください。'
          );
        }
        await Notifications.requestPermissionsAsync();

        setReady(true);
      } catch (e) {
        console.log('init error', e);
        Alert.alert('初期化エラー', String(e));
      }
    })();
  }, []);

  // spots の変化を購読し、変わるたびにジオフェンスを登録し直す
  useEffect(() => {
    if (!ready || !uid) return;
    const q = query(collection(db, 'spots'), where('ownerId', '==', uid));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const list = [];
      querySnapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setSpots(list);
      registerGeofences(list);
    });
    return unsubscribe;
  }, [ready, uid]);

  const registerGeofences = useCallback(async (list) => {
    const regions = list
      .filter((s) => typeof s.lat === 'number' && typeof s.lng === 'number')
      .map((s) => ({
        identifier: s.id,
        latitude: s.lat,
        longitude: s.lng,
        radius: GEOFENCE_RADIUS_METERS,
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
  }, []);

  const handleUseCurrentLocation = async () => {
    try {
      const position = await Location.getCurrentPositionAsync({});
      setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
    } catch (e) {
      Alert.alert('現在地の取得に失敗しました', String(e));
    }
  };

  const handleOpenMapPicker = async () => {
    // 地図の初期表示位置を決めるためだけに現在地を試みる（失敗してもデフォルト中心で開く）
    try {
      const position = await Location.getCurrentPositionAsync({});
      setMapCenter({ lat: position.coords.latitude, lng: position.coords.longitude });
    } catch (e) {
      // 取得できなければ DEFAULT_CENTER のまま
    }
    setMapVisible(true);
  };

  const handleMapConfirm = (lat, lng) => {
    setLocation({ lat, lng });
    setMapVisible(false);
  };

  const handleAddSpot = async () => {
    if (!name.trim()) {
      Alert.alert('場所の名前を入力してください');
      return;
    }
    if (!location) {
      Alert.alert('場所を選択してください', '「現在地を使う」か「地図で選ぶ」で位置を指定してください。');
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, 'spots'), {
        ownerId: uid,
        name: name.trim(),
        category,
        lat: location.lat,
        lng: location.lng,
        visits: [
          {
            date: new Date().toISOString(),
            goodPoint: goodPoint.trim(),
            caution: caution.trim(),
          },
        ],
        createdAt: serverTimestamp(),
      });
      setName('');
      setGoodPoint('');
      setCaution('');
      setLocation(null);
    } catch (e) {
      Alert.alert('保存に失敗しました', String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="auto" />
      <Text style={styles.title}>マイカルテ</Text>
      <Text style={styles.subtitle}>
        {ready ? '現在地でスポットを記録できます' : '準備中...'}
      </Text>

      <View style={styles.form}>
        <View style={styles.locationRow}>
          <TouchableOpacity style={styles.locationButton} onPress={handleUseCurrentLocation}>
            <Text style={styles.locationButtonText}>📍 現在地を使う</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.locationButton} onPress={handleOpenMapPicker}>
            <Text style={styles.locationButtonText}>🗺 地図で選ぶ</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.locationStatus}>
          {location
            ? `選択済み: ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`
            : '位置が未選択です'}
        </Text>
        <TextInput
          style={styles.input}
          placeholder="場所の名前（例: 油そば〇〇）"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={styles.input}
          placeholder="カテゴリ（飲食／美容／通院／バイト／その他）"
          value={category}
          onChangeText={setCategory}
        />
        <TextInput
          style={styles.input}
          placeholder="良かったこと・オススメ"
          value={goodPoint}
          onChangeText={setGoodPoint}
        />
        <TextInput
          style={styles.input}
          placeholder="次回に活かすこと・注意点"
          value={caution}
          onChangeText={setCaution}
        />
        <TouchableOpacity
          style={[styles.button, saving && styles.buttonDisabled]}
          onPress={handleAddSpot}
          disabled={saving || !ready || !uid}
        >
          <Text style={styles.buttonText}>
            {saving ? '保存中...' : '今いる場所として記録する'}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        style={styles.list}
        data={spots}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const last = (item.visits || [])[item.visits.length - 1];
          return (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {item.name}（{item.category}）
              </Text>
              {last?.goodPoint ? <Text>◎ {last.goodPoint}</Text> : null}
              {last?.caution ? <Text>⚠ {last.caution}</Text> : null}
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>まだ記録がありません</Text>}
      />

      <MapPicker
        visible={mapVisible}
        initialLat={mapCenter.lat}
        initialLng={mapCenter.lng}
        onConfirm={handleMapConfirm}
        onCancel={() => setMapVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  title: { fontSize: 24, fontWeight: 'bold' },
  subtitle: { color: '#666', marginBottom: 12 },
  form: { gap: 8, marginBottom: 16 },
  locationRow: { flexDirection: 'row', gap: 8 },
  locationButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#2f6fed',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  locationButtonText: { color: '#2f6fed', fontWeight: 'bold' },
  locationStatus: { color: '#666', fontSize: 12, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  button: {
    backgroundColor: '#2f6fed',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  list: { flex: 1 },
  card: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  cardTitle: { fontWeight: 'bold', marginBottom: 4 },
  empty: { color: '#999', textAlign: 'center', marginTop: 24 },
});
