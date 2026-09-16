import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  getReactNativePersistence,
  signInAnonymously,
  onAuthStateChanged,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyCuilmbKaqBoaaQNfWVhMVxx8UwvhkVzSI',
  authDomain: 'replace-18d0b.firebaseapp.com',
  projectId: 'replace-18d0b',
  storageBucket: 'replace-18d0b.firebasestorage.app',
  messagingSenderId: '355532398730',
  appId: '1:355532398730:web:98bb69960519e9de080d73',
};

export const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export const db = getFirestore(app);

// 起動直後はAsyncStorageからのセッション復元が非同期のため、
// auth.currentUser を即座に見るのではなく、最初の onAuthStateChanged を待ってから
// 未ログインなら匿名ログインする。バックグラウンドタスクから呼ばれる場合も同じ関数を使う。
export function waitForAuth() {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        unsubscribe();
        if (user) {
          resolve(user);
          return;
        }
        try {
          const credential = await signInAnonymously(auth);
          resolve(credential.user);
        } catch (e) {
          reject(e);
        }
      },
      reject
    );
  });
}
