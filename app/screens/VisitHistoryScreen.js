import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { subscribeToSpot } from '../core/spots';

// ⑥訪問履歴。C担当。
// route.params: { spotId: string }
export default function VisitHistoryScreen({ route, navigation }) {
  const { spotId } = route.params;
  const [spot, setSpot] = useState(null);

  useEffect(() => {
    const unsubscribe = subscribeToSpot(spotId, setSpot);
    return unsubscribe;
  }, [spotId]);

  const visits = (spot?.visits || [])
    .map((v, index) => ({ ...v, index }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <View style={styles.container}>
      <FlatList
        data={visits}
        keyExtractor={(item) => String(item.index)}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() =>
              navigation.navigate('VisitForm', { spotId, visitIndex: item.index })
            }
          >
            <Text style={styles.date}>{(item.date || '').slice(0, 10)}</Text>
            <Text style={styles.content} numberOfLines={1}>
              {item.content || item.goodPoint || '（内容なし）'}
            </Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>まだ記録がありません</Text>}
      />
      <Text style={styles.hint}>
        一覧から過去の記録を選択して、内容を編集できます。
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  date: { width: 90, color: '#666' },
  content: { flex: 1, fontSize: 15 },
  chevron: { color: '#ccc', fontSize: 20 },
  empty: { color: '#999', textAlign: 'center', marginTop: 40 },
  hint: { color: '#999', fontSize: 12, marginTop: 12, textAlign: 'center' },
});
