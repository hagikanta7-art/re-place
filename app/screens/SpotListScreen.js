import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { getAuth } from 'firebase/auth';
import { subscribeToSpots, latestVisit } from '../core/spots';

// カテゴリごとの簡単なアイコン表示（担当Aがここを好きに拡張してよい）
const CATEGORY_ICON = {
  飲食: '🍜',
  美容: '✂️',
  通院: '🏥',
  バイト: '💼',
};

// ②場所一覧。A担当。
export default function SpotListScreen({ navigation }) {
  const [spots, setSpots] = useState([]);
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) return;
    const unsubscribe = subscribeToSpots(uid, setSpots);
    return unsubscribe;
  }, []);

  const filtered = spots.filter((s) => s.name?.includes(keyword));

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="場所を検索"
        value={keyword}
        onChangeText={setKeyword}
      />
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const last = latestVisit(item);
          return (
            <TouchableOpacity
              style={styles.row}
              onPress={() => navigation.navigate('SpotDetail', { spotId: item.id })}
            >
              <Text style={styles.icon}>{CATEGORY_ICON[item.category] || '📍'}</Text>
              <View style={styles.rowText}>
                <Text style={styles.name}>{item.name}</Text>
                {last?.goodPoint ? (
                  <Text style={styles.preview} numberOfLines={1}>
                    ◎ {last.goodPoint}
                  </Text>
                ) : (
                  <Text style={styles.preview} numberOfLines={1}>
                    まだ記録がありません
                  </Text>
                )}
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>まだ場所が登録されていません</Text>
        }
      />
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('SpotForm', {})}
      >
        <Text style={styles.addButtonText}>＋ 場所を追加</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  search: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  icon: { fontSize: 22, marginRight: 12 },
  rowText: { flex: 1 },
  name: { fontSize: 16, fontWeight: 'bold' },
  preview: { color: '#666', fontSize: 12, marginTop: 2 },
  chevron: { color: '#ccc', fontSize: 20 },
  empty: { color: '#999', textAlign: 'center', marginTop: 40 },
  addButton: {
    backgroundColor: '#2f6fed',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  addButtonText: { color: '#fff', fontWeight: 'bold' },
});
