import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeTabs from './HomeTabs';
import OnboardingScreen from '../screens/OnboardingScreen';
import SpotFormScreen from '../screens/SpotFormScreen';
import SpotDetailScreen from '../screens/SpotDetailScreen';
import VisitFormScreen from '../screens/VisitFormScreen';
import VisitHistoryScreen from '../screens/VisitHistoryScreen';

const Stack = createNativeStackNavigator();

export default function RootNavigator({ showOnboarding }) {
  return (
    <Stack.Navigator
      initialRouteName={showOnboarding ? 'Onboarding' : 'Home'}
      screenOptions={{
        headerStyle: {
          backgroundColor: '#F5F7FB',
          shadowColor: 'transparent',
        },
        headerTintColor: '#111827',
        headerTitleStyle: {
          fontWeight: '700',
        },
        contentStyle: {
          backgroundColor: '#F5F7FB',
        },
      }}
    >
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
