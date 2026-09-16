import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import SpotListScreen from '../screens/SpotListScreen';
import SpotMapScreen from '../screens/SpotMapScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();

function TabIcon({ emoji, color = '#6B7280', focused = false }) {
  return <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.75, color }}>{emoji}</Text>;
}

export default function HomeTabs() {
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
          height: 64,
          paddingBottom: 8,
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
