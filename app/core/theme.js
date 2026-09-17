// 共通デザイン値。D担当。
// 他の画面ファイルはここから値を import して使うだけにし、
// このファイル自体の編集はDのみが行う（コンフリクト防止のルール）。

export const colors = {
  primary: '#2f6fed',
  text: '#222',
  textMuted: '#666',
  textFaint: '#999',
  border: '#eee',
  borderStrong: '#ccc',
  danger: '#d33',
  background: '#fff',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
};

export const radius = {
  sm: 8,
  md: 12,
};

export const categoryIcon = {
  飲食: '🍜',
  美容: '✂️',
  通院: '🏥',
  バイト: '💼',
  買い物: '🛍️',
  学習: '📚',
  その他: '📍',
};
