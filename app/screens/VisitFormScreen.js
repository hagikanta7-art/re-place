import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { getSpot, addVisit, updateVisit } from '../core/spots';

// ⑤記録追加・編集。C担当。
// route.params: { spotId: string, visitIndex?: number } … visitIndex があれば編集モード
export default function VisitFormScreen({ route, navigation }) {
  const { spotId, visitIndex } = route.params;
  const isEdit = typeof visitIndex === 'number';

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [content, setContent] = useState('');
  const [goodPoint, setGoodPoint] = useState('');
  const [caution, setCaution] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      const spot = await getSpot(spotId);
      const visit = spot?.visits?.[visitIndex];
      if (visit) {
        setDate((visit.date || '').slice(0, 10));
        setContent(visit.content || '');
        setGoodPoint(visit.goodPoint || '');
        setCaution(visit.caution || '');
      }
      setLoading(false);
    })();
  }, [isEdit, spotId, visitIndex]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const visit = {
        date: isEdit ? date : new Date().toISOString(),
        content: content.trim(),
        goodPoint: goodPoint.trim(),
        caution: caution.trim(),
        photoBase64: null, // TODO: 写真フォームは③側と合わせて後日拡張
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
    <ScrollView style={styles.container} contentContainerStyle={{ gap: 8 }}>
      <Text style={styles.label}>訪問日</Text>
      <Text style={styles.dateText}>{isEdit ? date : '本日（保存時刻で記録されます）'}</Text>

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
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  label: { fontSize: 13, color: '#666', marginTop: 4 },
  dateText: { fontSize: 15, marginBottom: 4 },
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
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: 'bold' },
});
