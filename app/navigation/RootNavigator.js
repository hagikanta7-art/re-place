import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeTabs from './HomeTabs';
import OnboardingScreen from '../screens/OnboardingScreen';
import SpotFormScreen from '../screens/SpotFormScreen';
import SpotDetailScreen from '../screens/SpotDetailScreen';
import VisitFormScreen from '../screens/VisitFormScreen';
import VisitHistoryScreen from '../screens/VisitHistoryScreen';

const Stack = createNativeStackNavigator();

// ルート定義（画面遷移図の①〜⑥に対応）。
// パラメータの契約:
//   SpotForm       { spotId?: string }               … 省略時は新規登録
//   SpotDetail     { spotId: string }
//   VisitForm      { spotId: string, visitIndex?: number } … 省略時は新規追加
//   VisitHistory   { spotId: string }
export default function RootNavigator({ showOnboarding }) {
  return (
    <Stack.Navigator initialRouteName={showOnboarding ? 'Onboarding' : 'Home'}>
      <Stack.Screen
        name="Onboarding"
        component={OnboardingScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="Home" component={HomeTabs} options={{ headerShown: false }} />
      <Stack.Screen
        name="SpotForm"
        component={SpotFormScreen}
        options={{ title: '場所の登録' }}
      />
      <Stack.Screen
        name="SpotDetail"
        component={SpotDetailScreen}
        options={{ title: '場所のカルテ' }}
      />
      <Stack.Screen
        name="VisitForm"
        component={VisitFormScreen}
        options={{ title: '記録の追加' }}
      />
      <Stack.Screen
        name="VisitHistory"
        component={VisitHistoryScreen}
        options={{ title: '訪問履歴' }}
      />
    </Stack.Navigator>
  );
}
