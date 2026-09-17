import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAuth } from 'firebase/auth';
import { subscribeToSpots, latestVisit } from '../core/spots';
import { categoryIcon } from '../core/theme';

export default function SpotListScreen({ navigation }) {
  const [spots, setSpots] = useState([]);
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) return;

    const unsubscribe = subscribeToSpots(uid, setSpots);
    return unsubscribe;
  }, []);

  const filteredSpots = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword) return spots;

    return spots.filter((spot) => {
      const name = (spot.name ?? '').toLowerCase();
      const category = (spot.category ?? '').toLowerCase();
      return name.includes(normalizedKeyword) || category.includes(normalizedKeyword);
    });
  }, [spots, keyword]);

  const renderItem = ({ item }) => {
    const lastVisit = latestVisit(item);
    const previewText =
      lastVisit?.goodPoint || lastVisit?.content || 'まだ記録がありません';

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('SpotDetail', { spotId: item.id })}
        activeOpacity={0.8}
      >
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>{categoryIcon[item.category] || '📍'}</Text>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.titleRow}>
            <Text style={styles.name}>{item.name || '名称未設定'}</Text>
            <Text style={styles.chevron}>›</Text>
          </View>

          <Text style={styles.category}>{item.category || '未分類'}</Text>
          <Text style={styles.preview} numberOfLines={2}>
            {previewText}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>場所一覧</Text>
      </View>

      <TextInput
        style={styles.search}
        value={keyword}
        onChangeText={setKeyword}
        placeholder="場所やカテゴリを検索"
        placeholderTextColor="#8A8F98"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <FlatList
        data={filteredSpots}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>まだ場所がありません</Text>
            <Text style={styles.emptyText}>右下のボタンから場所を追加してみましょう。</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('SpotForm', {})}
        activeOpacity={0.9}
      >
        <Text style={styles.addButtonText}>＋ 場所を追加</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
  },
  search: {
    marginHorizontal: 18,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 15,
    color: '#1F2937',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 90,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#EAF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 24,
  },
  cardBody: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    flexShrink: 1,
  },
  chevron: {
    fontSize: 22,
    color: '#9CA3AF',
    marginLeft: 8,
  },
  category: {
    marginTop: 4,
    fontSize: 12,
    color: '#4B5563',
  },
  preview: {
    marginTop: 8,
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
  },
  emptyText: {
    marginTop: 8,
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
  },
  addButton: {
    position: 'absolute',
    right: 18,
    bottom: 22,
    backgroundColor: '#2F6FED',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 20,
    shadowColor: '#2F6FED',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
