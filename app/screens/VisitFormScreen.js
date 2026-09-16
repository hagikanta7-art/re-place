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
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getSpot, addVisit, updateVisit } from '../core/spots';
import { colors, spacing, radius } from '../core/theme';

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

  const handleSave = async () => {
    setSaving(true);
    try {
      const visit = {
        date: date.toISOString(),
        content: content.trim(),
        goodPoint: goodPoint.trim(),
        caution: caution.trim(),
        photoBase64: null, // TODO: 写真は③(SpotFormScreen)側の実装と合わせて後日拡張
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
