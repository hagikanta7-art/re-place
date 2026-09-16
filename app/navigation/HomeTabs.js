import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import SpotListScreen from '../screens/SpotListScreen';
import SpotMapScreen from '../screens/SpotMapScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();

function TabIcon({ emoji }) {
  return <Text style={{ fontSize: 18 }}>{emoji}</Text>;
}

// ②場所一覧 / 地図タブ / ⑦設定 のボトムタブ。
export default function HomeTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen
        name="SpotList"
        component={SpotListScreen}
        options={{ title: '場所一覧', tabBarIcon: () => <TabIcon emoji="🏠" /> }}
      />
      <Tab.Screen
        name="SpotMap"
        component={SpotMapScreen}
        options={{ title: '地図', tabBarIcon: () => <TabIcon emoji="🗺" /> }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: '設定', tabBarIcon: () => <TabIcon emoji="⚙️" /> }}
      />
    </Tab.Navigator>
  );
}
