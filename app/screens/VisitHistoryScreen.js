import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { subscribeToSpot } from '../core/spots';
import { colors, spacing, radius } from '../core/theme';

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}

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
      {visits.length > 0 && (
        <Text style={styles.count}>全{visits.length}件の記録</Text>
      )}
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
            <Text style={styles.date}>{formatDate(item.date)}</Text>
            <View style={styles.rowText}>
              <Text style={styles.content} numberOfLines={1}>
                {item.content || '（内容なし）'}
              </Text>
              {(item.goodPoint || item.caution) && (
                <Text style={styles.sub} numberOfLines={1}>
                  {item.goodPoint ? `◎ ${item.goodPoint}` : ''}
                  {item.goodPoint && item.caution ? '　' : ''}
                  {item.caution ? `⚠ ${item.caution}` : ''}
                </Text>
              )}
            </View>
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
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  count: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  date: { width: 84, color: colors.textMuted, fontSize: 13 },
  rowText: { flex: 1 },
  content: { fontSize: 15, color: colors.text },
  sub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  chevron: { color: colors.borderStrong, fontSize: 20 },
  empty: { color: colors.textFaint, textAlign: 'center', marginTop: 40 },
  hint: { color: colors.textFaint, fontSize: 12, marginTop: spacing.sm, textAlign: 'center' },
});
