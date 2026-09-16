import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { subscribeToSpot, latestVisit, deleteSpot } from '../core/spots';

const CATEGORY_ICON = {
  飲食: '🍜',
  美容: '✂️',
  通院: '🏥',
  バイト: '💼',
};

// ④場所のカルテ。C担当。
// route.params: { spotId: string }
export default function SpotDetailScreen({ route, navigation }) {
  const { spotId } = route.params;
  const [spot, setSpot] = useState(null);

  useEffect(() => {
    const unsubscribe = subscribeToSpot(spotId, setSpot);
    return unsubscribe;
  }, [spotId]);

  useEffect(() => {
    navigation.setOptions({
      title: spot?.name || '場所のカルテ',
      headerRight: () => (
        <TouchableOpacity onPress={() => navigation.navigate('SpotForm', { spotId })}>
          <Text style={styles.headerAction}>編集</Text>
        </TouchableOpacity>
      ),
    });
  }, [spot, spotId]);

  if (!spot) {
    return (
      <View style={styles.container}>
        <Text>読み込み中...</Text>
      </View>
    );
  }

  const last = latestVisit(spot);

  const handleDelete = () => {
    Alert.alert('この場所を削除しますか？', '記録もすべて削除されます。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除する',
        style: 'destructive',
        onPress: async () => {
          await deleteSpot(spotId);
          navigation.navigate('Home');
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.icon}>{CATEGORY_ICON[spot.category] || '📍'}</Text>
        <Text style={styles.title}>{spot.name}</Text>
      </View>

      {last ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>📝 前回の内容</Text>
          <Text style={styles.cardValue}>{last.content || '（未記入）'}</Text>
          <Text style={styles.cardLabel}>◎ 良かったこと</Text>
          <Text style={styles.cardValue}>{last.goodPoint || '（未記入）'}</Text>
          <Text style={styles.cardLabel}>⚠ 次回の注意点</Text>
          <Text style={styles.cardValue}>{last.caution || '（未記入）'}</Text>
        </View>
      ) : (
        <Text style={styles.empty}>まだ記録がありません</Text>
      )}

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => navigation.navigate('VisitForm', { spotId })}
      >
        <Text style={styles.primaryButtonText}>＋ 今回の記録</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.linkRow}
        onPress={() => navigation.navigate('VisitHistory', { spotId })}
      >
        <Text style={styles.linkText}>🕒 訪問履歴</Text>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
        <Text style={styles.deleteButtonText}>この場所を削除</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  headerAction: { color: '#2f6fed', fontWeight: 'bold' },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  icon: { fontSize: 28, marginRight: 8 },
  title: { fontSize: 22, fontWeight: 'bold' },
  card: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  cardLabel: { fontSize: 12, color: '#999', marginTop: 8 },
  cardValue: { fontSize: 15, marginTop: 2 },
  empty: { color: '#999', marginBottom: 16 },
  primaryButton: {
    backgroundColor: '#2f6fed',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: { color: '#fff', fontWeight: 'bold' },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  linkText: { fontSize: 15 },
  chevron: { color: '#ccc', fontSize: 20 },
  deleteButton: { marginTop: 24, alignItems: 'center' },
  deleteButtonText: { color: '#d33', fontSize: 13 },
});
