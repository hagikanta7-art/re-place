import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_DONE_KEY = 'onboardingDone';

export async function isOnboardingDone() {
  const value = await AsyncStorage.getItem(ONBOARDING_DONE_KEY);
  return value === 'true';
}

// ①はじめに。D担当。今はテキストのみの最小実装。
// デザイン担当がここにアプリの説明・イラスト等を追加していく想定。
export default function OnboardingScreen({ navigation }) {
  const handleStart = async () => {
    await AsyncStorage.setItem(ONBOARDING_DONE_KEY, 'true');
    navigation.replace('Home');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>マイカルテ</Text>
      <Text style={styles.description}>
        行った場所のことを次に活かせる、あなただけのカルテです。
      </Text>
      <Text style={styles.bullet}>・行った場所を記録して次回に活かせます</Text>
      <Text style={styles.bullet}>
        ・近づいたときに、前回のメモをお知らせします
      </Text>
      <TouchableOpacity style={styles.button} onPress={handleStart}>
        <Text style={styles.buttonText}>はじめる</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  description: { fontSize: 14, color: '#666', marginBottom: 24, textAlign: 'center' },
  bullet: { fontSize: 14, color: '#333', marginBottom: 8 },
  button: {
    backgroundColor: '#2f6fed',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
