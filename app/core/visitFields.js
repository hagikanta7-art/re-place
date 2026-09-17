// カテゴリごとの記録フォーム定義。
// content / goodPoint / caution は既存の3つの自由記述欄を流用し、ラベルと
// placeholder だけカテゴリに合わせて変える（null にするとその欄自体を非表示にする）。
// extra は各カテゴリだけで使う追加項目（金額・日付など）。visit.extra オブジェクトに保存する。

export const VISIT_FIELDS = {
  飲食: {
    content: { label: '頼んだメニュー', placeholder: '例）油そば大盛り' },
    goodPoint: { label: '良かったこと', placeholder: '例）麺がもちもちで美味しい' },
    caution: { label: '次回頼みたいもの・注意点', placeholder: '例）辛味は普通で' },
    extra: [{ key: 'price', label: '金額（任意）', placeholder: '例）980', type: 'number' }],
  },
  美容: {
    content: { label: '施術内容', placeholder: '例）カット＋カラー' },
    goodPoint: null,
    caution: { label: '次回リクエスト内容', placeholder: '例）もう少し短めに' },
    extra: [
      { key: 'stylistName', label: '担当スタイリスト名', placeholder: '例）山田さん', type: 'text' },
      { key: 'price', label: '金額（任意）', placeholder: '例）8000', type: 'number' },
    ],
  },
  通院: {
    content: { label: '診療科・症状', placeholder: '例）内科／のどの痛み' },
    goodPoint: { label: '診断内容・処方薬', placeholder: '例）風邪、咳止めを処方' },
    caution: { label: '持ち物・確認事項', placeholder: '例）お薬手帳を忘れずに' },
    extra: [{ key: 'nextAppointmentDate', label: '次回予約日', type: 'date' }],
  },
  バイト: {
    content: { label: '業務内容', placeholder: '例）レジ対応・品出し' },
    goodPoint: { label: '良かった点・困った点', placeholder: '例）新人教育を任された' },
    caution: { label: '次回までの確認事項・持ち物', placeholder: '例）制服をクリーニングに出す' },
    extra: [],
  },
  買い物: {
    content: { label: '購入した商品', placeholder: '例）冬用のコート' },
    goodPoint: null,
    caution: { label: '次に欲しいもの・リピート候補', placeholder: '例）同じブランドのマフラー' },
    extra: [
      { key: 'size', label: 'サイズ・型番（任意）', placeholder: '例）Mサイズ', type: 'text' },
      { key: 'price', label: '金額', placeholder: '例）12000', type: 'number' },
    ],
  },
  学習: {
    content: { label: '集中できたか・滞在時間', placeholder: '例）2時間、集中できた' },
    goodPoint: { label: '環境メモ', placeholder: '例）Wi-Fiあり、コンセント少なめ' },
    caution: { label: '次回の持ち物・注意点', placeholder: '例）長居NG、ドリンク必須' },
    extra: [],
  },
  その他: {
    content: { label: '今回の内容', placeholder: '例）〇〇をした' },
    goodPoint: { label: '良かったこと', placeholder: '' },
    caution: { label: '次回の注意点', placeholder: '' },
    extra: [],
  },
};

export function getVisitFields(category) {
  return VISIT_FIELDS[category] || VISIT_FIELDS['その他'];
}
