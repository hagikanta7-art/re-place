import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SpotListScreen from '../screens/SpotListScreen';
import SpotMapScreen from '../screens/SpotMapScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();
const TAB_BAR_CONTENT_HEIGHT = 48; // アイコン・ラベル部分の高さ（余白は端末ごとのinsetで足す）

function TabIcon({ emoji, color = '#6B7280', focused = false }) {
  return <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.75, color }}>{emoji}</Text>;
}

export default function HomeTabs() {
  // Android機種によってナビゲーションバー（3ボタン/ジェスチャー）の高さが違うため、
  // 固定値ではなく safe area の下端インセットを足してタブバーの高さ・余白を決める。
  // これをしないと、機種によってはタブが画面下部のシステムナビゲーションと
  // 重なって押しにくくなる。
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      initialRouteName="SpotList"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#2F6FED',
        tabBarInactiveTintColor: '#9AA5B1',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E5E7EB',
          height: TAB_BAR_CONTENT_HEIGHT + Math.max(insets.bottom, 8) + 8,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarIcon: ({ color, focused }) => {
          if (route.name === 'SpotList') return <TabIcon emoji="🏠" color={color} focused={focused} />;
          if (route.name === 'SpotMap') return <TabIcon emoji="🗺" color={color} focused={focused} />;
          return <TabIcon emoji="⚙️" color={color} focused={focused} />;
        },
      })}
    >
      <Tab.Screen
        name="SpotList"
        component={SpotListScreen}
        options={{ title: '場所一覧' }}
      />
      <Tab.Screen
        name="SpotMap"
        component={SpotMapScreen}
        options={{ title: '地図' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: '設定' }}
      />
    </Tab.Navigator>
  );
}
