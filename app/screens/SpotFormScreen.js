import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
  StyleSheet,
  ScrollView,
} from 'react-native';
import * as Location from 'expo-location';
import { getAuth } from 'firebase/auth';
import { createSpot, updateSpotInfo, getSpot } from '../core/spots';
import { categoryIcon } from '../core/theme';
import MapPicker from '../MapPicker';

const DEFAULT_CENTER = { lat: 35.681236, lng: 139.767125 }; // 東京駅（フォールバック）
const CATEGORIES = Object.keys(categoryIcon);

// ③場所登録・編集。B担当。
// route.params: { spotId?: string } … spotId があれば編集モード
export default function SpotFormScreen({ route, navigation }) {
  const spotId = route.params?.spotId;
  const isEdit = !!spotId;

  const [name, setName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [location, setLocationState] = useState(null); // { lat, lng }
  const [mapVisible, setMapVisible] = useState(false);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    navigation.setOptions({ title: isEdit ? '場所を編集' : '場所の登録' });
  }, [isEdit]);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      const spot = await getSpot(spotId);
      if (spot) {
        setName(spot.name || '');
        setCategory(spot.category || CATEGORIES[0]);
        setNotifyEnabled(spot.notifyEnabled !== false);
        setLocationState({ lat: spot.lat, lng: spot.lng });
      }
      setLoading(false);
    })();
  }, [isEdit, spotId]);

  const handleUseCurrentLocation = async () => {
    try {
      const position = await Location.getCurrentPositionAsync({});
      setLocationState({ lat: position.coords.latitude, lng: position.coords.longitude });
    } catch (e) {
      Alert.alert('現在地の取得に失敗しました', String(e));
    }
  };

  const handleOpenMapPicker = async () => {
    try {
      const position = await Location.getCurrentPositionAsync({});
      setMapCenter({ lat: position.coords.latitude, lng: position.coords.longitude });
    } catch (e) {
      // 失敗したら DEFAULT_CENTER のまま
    }
    setMapVisible(true);
  };

  const handleSave = async () => {
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
      if (isEdit) {
        await updateSpotInfo(spotId, {
          name: name.trim(),
          category,
          notifyEnabled,
          lat: location.lat,
          lng: location.lng,
        });
        navigation.goBack();
      } else {
        const uid = getAuth().currentUser?.uid;
        const newId = await createSpot(uid, {
          name: name.trim(),
          category,
          notifyEnabled,
          lat: location.lat,
          lng: location.lng,
        });
        navigation.replace('SpotDetail', { spotId: newId });
      }
    } catch (e) {
      Alert.alert('保存に失敗しました', String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>読み込み中...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ gap: 8 }}>
      <TextInput
        style={styles.input}
        placeholder="場所名（例: ラーメン店）"
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>地図で位置を指定</Text>
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

      <Text style={styles.label}>カテゴリ</Text>
      <View style={styles.categoryRow}>
        {CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.categoryChip, category === c && styles.categoryChipSelected]}
            onPress={() => setCategory(c)}
          >
            <Text style={[styles.categoryChipText, category === c && styles.categoryChipTextSelected]}>
              {categoryIcon[c]} {c}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.label}>通知 ON / OFF</Text>
        <Switch value={notifyEnabled} onValueChange={setNotifyEnabled} />
      </View>

      <TouchableOpacity
        style={[styles.button, saving && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.buttonText}>{saving ? '保存中...' : '保存'}</Text>
      </TouchableOpacity>

      <MapPicker
        visible={mapVisible}
        initialLat={mapCenter.lat}
        initialLng={mapCenter.lng}
        onConfirm={(lat, lng) => {
          setLocationState({ lat, lng });
          setMapVisible(false);
        }}
        onCancel={() => setMapVisible(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  label: { fontSize: 13, color: '#666' },
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
  locationStatus: { color: '#666', fontSize: 12 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  categoryChipSelected: {
    backgroundColor: '#2f6fed',
    borderColor: '#2f6fed',
  },
  categoryChipText: { color: '#666', fontSize: 14 },
  categoryChipTextSelected: { color: '#fff', fontWeight: 'bold' },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  button: {
    backgroundColor: '#2f6fed',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: 'bold' },
});
