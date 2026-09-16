// spots コレクションへのアクセスをまとめた共通データ層。
// 画面側は Firestore を直接触らず、必ずこのファイルの関数を経由すること。
// （担当が分かれても、データの形が食い違わないようにするための土台）
//
// spots/{spotId}
//   ownerId: string
//   name: string
//   category: string
//   lat: number
//   lng: number
//   notifyEnabled: boolean        … この場所の到着通知を有効にするか
//   createdAt: serverTimestamp
//   visits: [
//     {
//       date: string (ISO8601),
//       content: string,          … 今回の内容（例: 油そば大盛り）
//       goodPoint: string,        … 良かったこと
//       caution: string,          … 次回の注意点
//       photoBase64: string|null, … 圧縮済み画像。任意
//     },
//     ...
//   ]

import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from './firebase';

const SPOTS_COLLECTION = 'spots';

// バックグラウンドでジオフェンスタスクが起こされた直後は、Firestoreの接続が
// 間に合わず "client is offline" で読み取りに失敗することがある（実機の診断ログで確認済み）。
// そのため、アプリが通常起動中に取得できたスポット一覧を端末内にキャッシュしておき、
// バックグラウンドタスク側はオンライン取得に失敗したときだけこちらにフォールバックする。
const SPOTS_CACHE_KEY = 'spots:cache';

async function cacheSpots(spots) {
  try {
    await AsyncStorage.setItem(SPOTS_CACHE_KEY, JSON.stringify(spots));
  } catch (e) {
    // キャッシュ保存の失敗は無視してよい（次にオンラインで取れた時にまた保存される）
  }
}

export async function getCachedSpot(spotId) {
  try {
    const raw = await AsyncStorage.getItem(SPOTS_CACHE_KEY);
    const spots = raw ? JSON.parse(raw) : [];
    return spots.find((s) => s.id === spotId) || null;
  } catch (e) {
    return null;
  }
}

export function normalizeSpot(raw) {
  if (!raw || typeof raw !== 'object') return null;

  return {
    ...raw,
    ownerId: raw.ownerId ?? '',
    name: raw.name ?? '名称未設定',
    category: raw.category ?? '未分類',
    lat: typeof raw.lat === 'number' ? raw.lat : null,
    lng: typeof raw.lng === 'number' ? raw.lng : null,
    notifyEnabled: raw.notifyEnabled ?? true,
    visits: Array.isArray(raw.visits) ? raw.visits : [],
  };
}

export function emptyVisit() {
  return { date: new Date().toISOString(), content: '', goodPoint: '', caution: '', photoBase64: null };
}

// 自分の spots 一覧をリアルタイム購読する。戻り値は unsubscribe 関数。
export function subscribeToSpots(uid, onChange) {
  const q = query(collection(db, SPOTS_COLLECTION), where('ownerId', '==', uid));
  return onSnapshot(q, (snapshot) => {
    const list = [];
    snapshot.forEach((d) => {
      const spot = normalizeSpot({ id: d.id, ...d.data() });
      if (spot) list.push(spot);
    });
    onChange(list);
    cacheSpots(list); // ジオフェンスのバックグラウンドタスクからのフォールバック用
  });
}

// 1件の spot をリアルタイム購読する（カルテ画面・訪問履歴画面で使う）
export function subscribeToSpot(spotId, onChange) {
  return onSnapshot(doc(db, SPOTS_COLLECTION, spotId), (snap) => {
    const next = snap.exists() ? normalizeSpot({ id: snap.id, ...snap.data() }) : null;
    onChange(next);
  });
}

// 1回だけ取得（バックグラウンドタスクなど、購読が要らない場所で使う）
export async function getSpot(spotId) {
  const snap = await getDoc(doc(db, SPOTS_COLLECTION, spotId));
  return snap.exists() ? normalizeSpot({ id: snap.id, ...snap.data() }) : null;
}

// 新しい場所を作成する（③場所登録画面用）。訪問記録はまだ空で、
// ④のカルテから「+ 今回の記録」で最初の記録を追加する流れを想定。
export async function createSpot(uid, { name, category = '未分類', lat, lng, notifyEnabled = true }) {
  const ref = await addDoc(collection(db, SPOTS_COLLECTION), {
    ownerId: uid,
    name: name || '名称未設定',
    category,
    lat,
    lng,
    notifyEnabled,
    visits: [],
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

// 場所そのものの情報（名前・カテゴリ・位置・通知ON/OFF）を更新する
export async function updateSpotInfo(spotId, fields) {
  await updateDoc(doc(db, SPOTS_COLLECTION, spotId), fields);
}

export async function deleteSpot(spotId) {
  await deleteDoc(doc(db, SPOTS_COLLECTION, spotId));
}

// 訪問記録を1件追加する（既存の記録は上書きしない = 蓄積機能の本体）
export async function addVisit(spotId, visit) {
  const spot = await getSpot(spotId);
  if (!spot) throw new Error('spot not found');
  const visits = [...(spot.visits || []), visit];
  await updateDoc(doc(db, SPOTS_COLLECTION, spotId), { visits });
}

// 既存の訪問記録（index指定）を編集する
export async function updateVisit(spotId, visitIndex, updatedVisit) {
  const spot = await getSpot(spotId);
  if (!spot) throw new Error('spot not found');
  const visits = [...(spot.visits || [])];
  if (visitIndex < 0 || visitIndex >= visits.length) throw new Error('visit index out of range');
  visits[visitIndex] = { ...visits[visitIndex], ...updatedVisit };
  await updateDoc(doc(db, SPOTS_COLLECTION, spotId), { visits });
}

export function latestVisit(spot) {
  const visits = spot?.visits || [];
  return visits.length > 0 ? visits[visits.length - 1] : null;
}
