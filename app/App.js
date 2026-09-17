import { useEffect, useRef, useState } from 'react';
import { View, Text, Alert, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

import { waitForAuth } from './core/firebase';
import { subscribeToSpots } from './core/spots';
import { registerGeofences, attachNotificationResponseHandler } from './core/geofence';
import { isOnboardingDone } from './screens/OnboardingScreen';
import RootNavigator from './navigation/RootNavigator';

const navigationRef = createNavigationContainerRef();

export default function App() {
  const [ready, setReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const detachNotificationHandler = useRef(null);

  useEffect(() => {
    let unsubscribe = null;

    (async () => {
      try {
        const user = await waitForAuth();
        const onboardingDone = await isOnboardingDone();
        setShowOnboarding(!onboardingDone);

        const fg = await Location.requestForegroundPermissionsAsync();
        if (fg.status !== 'granted') {
          Alert.alert('位置情報の許可が必要です', '設定から「位置情報」を許可してください。');
        } else {
          const bg = await Location.requestBackgroundPermissionsAsync();
          if (bg.status !== 'granted') {
            Alert.alert(
              '「常に許可」が必要です',
              'アプリを閉じていても通知するには、設定から位置情報を「常に許可」に変更してください。'
            );
          }
        }

        await Notifications.requestPermissionsAsync();
        unsubscribe = subscribeToSpots(user.uid, registerGeofences);
        detachNotificationHandler.current = attachNotificationResponseHandler(navigationRef);
      } catch (e) {
        console.log('init error', e);
        Alert.alert('初期化エラー', String(e));
      } finally {
        setReady(true);
      }
    })();

    return () => {
      unsubscribe?.();
      detachNotificationHandler.current?.();
    };
  }, []);

  if (!ready) {
    return (
      <SafeAreaProvider>
        <View style={styles.loading}>
          <StatusBar style="auto" />
          <Text>準備中...</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef}>
        <StatusBar style="auto" />
        <RootNavigator showOnboarding={showOnboarding} />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7FB',
  },
});
