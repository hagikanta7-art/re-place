import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ScrollView,
  Platform,
  Image,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { getSpot, addVisit, updateVisit } from '../core/spots';
import { colors, spacing, radius } from '../core/theme';

// Firestoreの1ドキュメント上限(1MB)に余裕を持って収まるよう、
// 幅600px・JPEG品質50%程度までリサイズ・圧縮してからBase64化する。
async function pickAndCompressImage(launch) {
  const result = await launch();
  if (result.canceled || !result.assets?.[0]) return null;
  const manipulated = await ImageManipulator.manipulateAsync(
    result.assets[0].uri,
    [{ resize: { width: 600 } }],
    { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );
  return manipulated.base64;
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}

// ⑤記録追加・編集。C担当。
// route.params: { spotId: string, visitIndex?: number } … visitIndex があれば編集モード
export default function VisitFormScreen({ route, navigation }) {
  const { spotId, visitIndex } = route.params;
  const isEdit = typeof visitIndex === 'number';

  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [content, setContent] = useState('');
  const [goodPoint, setGoodPoint] = useState('');
  const [caution, setCaution] = useState('');
  const [photoBase64, setPhotoBase64] = useState(null);
  const [pickingPhoto, setPickingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    navigation.setOptions({ title: isEdit ? '記録の編集' : '記録の追加' });
  }, [isEdit]);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      const spot = await getSpot(spotId);
      const visit = spot?.visits?.[visitIndex];
      if (visit) {
        if (visit.date) setDate(new Date(visit.date));
        setContent(visit.content || '');
        setGoodPoint(visit.goodPoint || '');
        setCaution(visit.caution || '');
        setPhotoBase64(visit.photoBase64 || null);
      }
      setLoading(false);
    })();
  }, [isEdit, spotId, visitIndex]);

  const handleDateChange = (event, selectedDate) => {
    // Androidはダイアログが閉じるたびに一度だけ呼ばれる。iOSはインライン表示のまま値だけ更新する。
    setShowDatePicker(Platform.OS === 'ios');
    if (event.type === 'dismissed') return;
    if (selectedDate) setDate(selectedDate);
  };

  const handleTakePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('カメラの許可が必要です');
      return;
    }
    setPickingPhoto(true);
    try {
      const base64 = await pickAndCompressImage(() =>
        ImagePicker.launchCameraAsync({ quality: 0.7 })
      );
      if (base64) setPhotoBase64(base64);
    } catch (e) {
      Alert.alert('撮影に失敗しました', String(e));
    } finally {
      setPickingPhoto(false);
    }
  };

  const handlePickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('写真ライブラリへのアクセス許可が必要です');
      return;
    }
    setPickingPhoto(true);
    try {
      const base64 = await pickAndCompressImage(() =>
        ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.7,
        })
      );
      if (base64) setPhotoBase64(base64);
    } catch (e) {
      Alert.alert('選択に失敗しました', String(e));
    } finally {
      setPickingPhoto(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const visit = {
        date: date.toISOString(),
        content: content.trim(),
        goodPoint: goodPoint.trim(),
        caution: caution.trim(),
        photoBase64,
      };
      if (isEdit) {
        await updateVisit(spotId, visitIndex, visit);
      } else {
        await addVisit(spotId, visit);
      }
      navigation.goBack();
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
    <ScrollView style={styles.container} contentContainerStyle={{ gap: spacing.sm }}>
      <Text style={styles.label}>訪問日</Text>
      <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
        <Text style={styles.dateButtonText}>📅 {formatDate(date)}</Text>
      </TouchableOpacity>
      {showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={handleDateChange}
          maximumDate={new Date()}
        />
      )}

      <Text style={styles.label}>今回の内容</Text>
      <TextInput
        style={styles.input}
        placeholder="例）油そば大盛り"
        value={content}
        onChangeText={setContent}
      />

      <Text style={styles.label}>良かったこと</Text>
      <TextInput
        style={styles.input}
        placeholder="例）麺がもちもちで美味しい"
        value={goodPoint}
        onChangeText={setGoodPoint}
      />

      <Text style={styles.label}>次回の注意点</Text>
      <TextInput
        style={styles.input}
        placeholder="例）辛味は普通で"
        value={caution}
        onChangeText={setCaution}
      />

      <Text style={styles.label}>写真（任意）</Text>
      {photoBase64 && (
        <View style={styles.photoWrap}>
          <Image
            source={{ uri: `data:image/jpeg;base64,${photoBase64}` }}
            style={styles.photo}
          />
          <TouchableOpacity onPress={() => setPhotoBase64(null)}>
            <Text style={styles.removePhoto}>写真を削除</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.photoRow}>
        <TouchableOpacity
          style={styles.photoButton}
          onPress={handleTakePhoto}
          disabled={pickingPhoto}
        >
          <Text style={styles.photoButtonText}>📷 撮影する</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.photoButton}
          onPress={handlePickPhoto}
          disabled={pickingPhoto}
        >
          <Text style={styles.photoButtonText}>🖼 ライブラリから選ぶ</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.button, saving && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.buttonText}>{saving ? '保存中...' : '保存'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  label: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs },
  dateButton: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignSelf: 'flex-start',
  },
  dateButtonText: { fontSize: 15, color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  photoRow: { flexDirection: 'row', gap: spacing.sm },
  photoButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
  },
  photoButtonText: { color: colors.primary, fontWeight: 'bold', fontSize: 13 },
  photoWrap: { marginBottom: spacing.xs },
  photo: {
    width: '100%',
    height: 180,
    borderRadius: radius.sm,
    marginBottom: spacing.xs,
    backgroundColor: colors.border,
  },
  removePhoto: { color: colors.danger, fontSize: 12, textAlign: 'right' },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: 'bold' },
});
