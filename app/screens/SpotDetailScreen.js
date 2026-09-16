import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, Alert, StyleSheet } from 'react-native';
import { subscribeToSpot, latestVisit, deleteSpot } from '../core/spots';
import { colors, spacing, radius, categoryIcon } from '../core/theme';

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

  const visits = spot.visits || [];
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
        <Text style={styles.icon}>{categoryIcon[spot.category] || '📍'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{spot.name}</Text>
          {visits.length > 0 && (
            <Text style={styles.visitCount}>
              📚 これまでに{visits.length}回の記録
            </Text>
          )}
        </View>
      </View>

      {last ? (
        <View style={styles.card}>
          {last.photoBase64 && (
            <Image
              source={{ uri: `data:image/jpeg;base64,${last.photoBase64}` }}
              style={styles.photo}
            />
          )}
          <Text style={styles.cardLabel}>📝 前回の内容</Text>
          <Text style={styles.cardValue}>{last.content || '（未記入）'}</Text>
          <Text style={styles.cardLabel}>◎ 良かったこと</Text>
          <Text style={styles.cardValue}>{last.goodPoint || '（未記入）'}</Text>
          <Text style={styles.cardLabel}>⚠ 次回の注意点</Text>
          <Text style={styles.cardValue}>{last.caution || '（未記入）'}</Text>
        </View>
      ) : (
        <Text style={styles.empty}>まだ記録がありません。最初の記録を追加しましょう。</Text>
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
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  headerAction: { color: colors.primary, fontWeight: 'bold' },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  icon: { fontSize: 28, marginRight: spacing.sm },
  title: { fontSize: 22, fontWeight: 'bold', color: colors.text },
  visitCount: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  photo: {
    width: '100%',
    height: 160,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
    backgroundColor: colors.border,
  },
  cardLabel: { fontSize: 12, color: colors.textFaint, marginTop: spacing.sm },
  cardValue: { fontSize: 15, marginTop: 2, color: colors.text },
  empty: { color: colors.textFaint, marginBottom: spacing.md },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  primaryButtonText: { color: '#fff', fontWeight: 'bold' },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  linkText: { fontSize: 15, color: colors.text },
  chevron: { color: colors.borderStrong, fontSize: 20 },
  deleteButton: { marginTop: spacing.lg, alignItems: 'center' },
  deleteButtonText: { color: colors.danger, fontSize: 13 },
});
