import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radius } from '../core/theme';

const ONBOARDING_DONE_KEY = 'onboardingDone';

export async function isOnboardingDone() {
  const value = await AsyncStorage.getItem(ONBOARDING_DONE_KEY);
  return value === 'true';
}

const FEATURES = [
  {
    icon: '📝',
    title: 'アプリの説明',
    description: '行った場所を記録して、次回に活かせます。',
  },
  {
    icon: '📍',
    title: '位置情報・通知の案内',
    description: '近づいたときに、前回のメモをお知らせします。',
  },
];

// ①はじめに。D担当。
export default function OnboardingScreen({ navigation }) {
  const handleStart = async () => {
    await AsyncStorage.setItem(ONBOARDING_DONE_KEY, 'true');
    navigation.replace('Home');
  };

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.heroIcon}>💙</Text>
        <Text style={styles.title}>Re:Place</Text>
        <Text style={styles.description}>
          行った場所のことを次に活かせる、{'\n'}あなただけのカルテです。
        </Text>
      </View>

      <View style={styles.features}>
        {FEATURES.map((f) => (
          <View key={f.title} style={styles.featureRow}>
            <View style={styles.featureIconWrap}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureDescription}>{f.description}</Text>
            </View>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.button} onPress={handleStart}>
        <Text style={styles.buttonText}>はじめる</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  hero: { alignItems: 'center', marginBottom: spacing.lg },
  heroIcon: { fontSize: 48, marginBottom: spacing.sm },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: spacing.sm, color: colors.text },
  description: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  features: { gap: spacing.md, marginBottom: spacing.lg },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  featureIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EAF1FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureIcon: { fontSize: 20 },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 15, fontWeight: 'bold', color: colors.text },
  featureDescription: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
