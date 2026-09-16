import { useEffect, useRef, useState } from 'react';
import { View, Text, Alert, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

import { waitForAuth } from './core/firebase';
import { subscribeToSpots } from './core/spots';
import { registerGeofences, attachNotificationResponseHandler } from './core/geofence';
import { isOnboardingDone } from './screens/OnboardingScreen';
import RootNavigator from './navigation/RootNavigator';

// 通知タップ時のナビゲーションに使う ref（画面のどこからでも navigate できるようにする）
const navigationRef = createNavigationContainerRef();

export default function App() {
  const [ready, setReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const detachNotificationHandler = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const user = await waitForAuth();
        setShowOnboarding(!(await isOnboardingDone()));

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

        // spots の変化に追随して、常にジオフェンス登録を最新化する（Must機能）
        subscribeToSpots(user.uid, registerGeofences);

        detachNotificationHandler.current = attachNotificationResponseHandler(navigationRef);

        setReady(true);
      } catch (e) {
        console.log('init error', e);
        Alert.alert('初期化エラー', String(e));
      }
    })();

    return () => {
      detachNotificationHandler.current?.();
    };
  }, []);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <StatusBar style="auto" />
        <Text>準備中...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar style="auto" />
      <RootNavigator showOnboarding={showOnboarding} />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
