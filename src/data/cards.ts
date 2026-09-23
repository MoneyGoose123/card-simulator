// カードのマスターデータと、規約改定で変わる前提の集約ファイル。
// 数値を変えるときはこのファイルだけを直す（計算ロジックに直書きしない）。

export const VERIFIED_AT = '2026-09-23'

export const PAYEES = ['oc', 'jp', 'amazon', 'yshop', 'yauc', 'yfurima', 'mercari', 'other'] as const
export type Payee = (typeof PAYEES)[number]

export const PAYEE_LABELS: Record<Payee, { name: string; note: string }> = {
  oc: { name: 'オレンジコネックス（SpeedPAK）', note: '送料・サーチャージ・関税' },
  jp: { name: '日本郵便', note: '窓口・オンラインでの送料' },
  amazon: { name: 'Amazon', note: 'Amazon Business、マーケットプレイスを含む' },
  yshop: { name: 'Yahoo!ショッピング', note: '' },
  yauc: { name: 'Yahoo!オークション', note: '' },
  yfurima: { name: 'Yahoo!フリマ', note: 'アメックスの3倍対象外' },
  mercari: { name: 'メルカリ', note: '' },
  other: { name: 'その他の仕入れ', note: '店舗、ほかの通販サイトなど' },
}

/** 送料（マリオットに割り当てない支払い先） */
export const SHIPPING_PAYEES: readonly Payee[] = ['oc', 'jp']

export const GOALS = ['ana', 'jal', 'hotel', 'cash'] as const
export type Goal = (typeof GOALS)[number]
export const GOAL_LABELS: Record<Goal, string> = {
  ana: 'ANAマイル',
  jal: 'JALマイル',
  hotel: 'ホテル',
  cash: '現金ポイント',
}
export const MAX_GOALS = 2

/** 貯まるもの */
export type Currency = 'cash' | 'ana' | 'jal' | 'marriott' | 'mr'
export type Role = 'core' | 'limit' | 'perk'

export interface Fee {
  label: string
  amount: number
  firstYearFree?: boolean
}

export interface Card {
  id: string
  name: string
  roles: Role[]
  /** 2年目以降の年会費の内訳（税込） */
  fees: Fee[]
  currency: Currency
  /** 1円あたりに貯まる単位（ポイント・マイル・円） */
  baseRate: number
  /** 支払い先ごとの還元（baseRate を上書き）。0 はポイント対象外 */
  payeeRates?: Partial<Record<Payee, number>>
  /** 入会・継続で毎年もらえるマイル */
  annualBonusMiles?: number
  /** 法人専用（個人事業主では候補から外す） */
  corpOnly?: boolean
  inviteOnly?: boolean
  /** 同じグループのカードは同時に持たない前提で探索する */
  exclusiveGroup?: string
  summary: string
  conditions: string
  sourceUrl: string
  verifiedAt: string
}

export const CARDS: Record<string, Card> = {
  air: {
    id: 'air',
    name: 'Airカード',
    roles: ['core'],
    fees: [{ label: '年会費', amount: 5_500 }],
    currency: 'cash',
    baseRate: 0.015,
    summary: '現金 1.5%',
    conditions: '光熱費など還元率が異なる場合・対象外あり。利用枠（総枠）は最大500万円、入会時は最大100万円',
    sourceUrl: 'https://airregi.jp/aircard/',
    verifiedAt: VERIFIED_AT,
  },
  mercard: {
    id: 'mercard',
    name: 'メルカード',
    roles: ['core'],
    fees: [],
    currency: 'cash',
    baseRate: 0.01, // メルカリ以外は通常1%（一部対象外の加盟店あり）
    payeeRates: { mercari: 0.04 }, // 実際の率は設定 mercardRate で上書きする
    summary: 'メルカリで1〜4%、その他1%',
    conditions: 'メルカリ還元は月5,000ポイントまで（計算は毎月均等に使う前提）',
    sourceUrl: 'https://help.jp.mercari.com/guide/articles/1227/',
    verifiedAt: VERIFIED_AT,
  },
  bizOne: {
    id: 'bizOne',
    name: 'JCB Biz ONE（一般）',
    roles: ['core'],
    fees: [],
    currency: 'cash',
    baseRate: 0.01,
    payeeRates: { amazon: 0.02 },
    summary: '1%、Amazonは2%',
    conditions: 'Amazon 2%は事前のポイントアップ登録が必要。法人口座不要',
    sourceUrl: 'https://www.jcb.co.jp/corporate/houjin/bizone.html',
    verifiedAt: VERIFIED_AT,
  },
  anaJcb: {
    id: 'anaJcb',
    name: 'ANA JCB法人カード（一般）',
    roles: ['core'],
    fees: [
      { label: '年会費', amount: 2_475, firstYearFree: true },
      { label: 'マイル移行手数料', amount: 5_500 },
    ],
    currency: 'ana',
    baseRate: 0.01,
    annualBonusMiles: 1_000,
    summary: 'ANAマイル 1%',
    conditions: '入会・継続で1,000マイル。年間の移行上限は記載なし。ボーナスポイントは1pt＝0.6マイル',
    sourceUrl: 'https://www.jcb.co.jp/corporate/houjin/ana.html',
    verifiedAt: VERIFIED_AT,
  },
  anaJcbWide: {
    id: 'anaJcbWide',
    name: 'ANA JCB法人カード ワイドゴールド',
    roles: ['perk'],
    fees: [{ label: '年会費', amount: 20_900 }],
    currency: 'ana',
    baseRate: 0.01,
    annualBonusMiles: 2_000,
    summary: 'ANAマイル 1%（移行手数料無料）',
    conditions: '入会・継続で2,000マイル。空港ラウンジなど',
    sourceUrl: 'https://www.jcb.co.jp/corporate/houjin/ana.html',
    verifiedAt: VERIFIED_AT,
  },
  anaDiners: {
    id: 'anaDiners',
    name: 'ANAダイナース',
    roles: ['limit', 'perk'],
    fees: [{ label: '年会費', amount: 33_000 }],
    currency: 'ana',
    baseRate: 0.01,
    summary: 'ANAマイル 1%',
    conditions: '移行上限・手数料なし（公式明記）。利用枠に一律の制限なし',
    sourceUrl: 'https://www.diners.co.jp/ja/cardlineup/anadiners_new.html',
    verifiedAt: VERIFIED_AT,
  },
  anaDinersPremium: {
    id: 'anaDinersPremium',
    name: 'ANAダイナース プレミアム',
    roles: ['core'],
    fees: [{ label: '年会費', amount: 198_000 }],
    currency: 'ana',
    // TODO(要確認): 1.5%が送料・関税でも付くか。現状はすべての支払い先で1.5%
    baseRate: 0.015,
    annualBonusMiles: 10_000,
    inviteOnly: true,
    summary: 'ANAマイル 1.5%',
    conditions: '継続10,000マイル。招待制',
    sourceUrl: 'https://www.diners.co.jp/ja/cardlineup/anadiners_premium.html',
    verifiedAt: VERIFIED_AT,
  },
  bizGreen: {
    id: 'bizGreen',
    name: 'アメックス・ビジネス・グリーン',
    roles: ['core'],
    fees: [
      { label: '年会費', amount: 13_200 },
      { label: 'メンバーシップ・リワード・プラス', amount: 3_300 },
      { label: 'ANAマイル移行の年間参加費', amount: 5_500 },
    ],
    currency: 'mr',
    baseRate: 0.01,
    payeeRates: { amazon: 0.03, yshop: 0.03, yauc: 0.03 },
    exclusiveGroup: 'amexMr',
    summary: '100円＝1pt、Amazon・Yahoo!は3pt',
    conditions: 'ANA移行は年4万マイルまで（アメックス全カード合算）。ANA移行には年間参加費5,500円',
    sourceUrl: 'https://www.americanexpress.com/ja-jp/point/membership-rewards-plus/',
    verifiedAt: VERIFIED_AT,
  },
  bizGold: {
    id: 'bizGold',
    name: 'アメックス・ビジネス・ゴールド',
    roles: ['perk'],
    fees: [
      { label: '年会費', amount: 49_500 },
      { label: 'メンバーシップ・リワード・プラス', amount: 3_300 },
      { label: 'ANAマイル移行の年間参加費', amount: 5_500 },
    ],
    currency: 'mr',
    baseRate: 0.01,
    payeeRates: { amazon: 0.03, yshop: 0.03, yauc: 0.03 },
    exclusiveGroup: 'amexMr',
    summary: 'グリーンと同じ',
    conditions: 'ANA上限もグリーンと同じ。特典・入会キャンペーン重視の人向け',
    sourceUrl: 'https://www.americanexpress.com/ja-jp/point/membership-rewards-plus/',
    verifiedAt: VERIFIED_AT,
  },
  saison: {
    id: 'saison',
    name: 'セゾンプラチナ・ビジネス・アメックス',
    roles: ['core'],
    fees: [
      { label: '年会費', amount: 33_000, firstYearFree: true },
      { label: 'SAISON MILE CLUB', amount: 5_500 },
    ],
    currency: 'jal',
    baseRate: 0.01125,
    summary: 'JALマイル 1.125%',
    conditions: 'JALマイル加算は年1,500万円まで',
    sourceUrl: 'https://partner.jal.co.jp/shop/?tp=200074',
    verifiedAt: VERIFIED_AT,
  },
  marriott: {
    id: 'marriott',
    name: 'マリオットボンヴォイ・アメックス・プレミアム',
    roles: ['core'],
    fees: [{ label: '年会費', amount: 82_500 }],
    currency: 'marriott',
    baseRate: 0.03,
    payeeRates: { oc: 0, jp: 0 }, // 運送関連費用は0pt（公式明記）
    summary: '100円＝3pt（送料は0pt）',
    conditions: '運送関連費用は0pt。60,000pt→ANA/JAL 25,000マイル。年400万円で無料宿泊',
    sourceUrl: 'https://www.americanexpress.com/ja-jp/credit-cards/marriott-bonvoy-premium/',
    verifiedAt: VERIFIED_AT,
  },
  upsider: {
    id: 'upsider',
    name: 'UPSIDER',
    roles: ['limit'],
    fees: [],
    currency: 'cash',
    baseRate: 0.01,
    corpOnly: true, // TODO(要確認): 仕様書は「法人向け」。個人事業主でも使えるか
    summary: '現金 1%（自動値引き）',
    conditions: '最大10億円の利用枠。法人向け',
    sourceUrl: 'https://up-sider.com/', // TODO(要確認): 仕様書の出典一覧にないため公式トップを仮置き
    verifiedAt: VERIFIED_AT,
  },
}

export type CardId = keyof typeof CARDS

/** 目的ごとの自動選択候補（role: core のみ） */
export const GOAL_CANDIDATES: Record<Goal, CardId[]> = {
  ana: ['anaJcb', 'anaDinersPremium', 'bizGreen', 'marriott'],
  jal: ['saison', 'marriott'],
  hotel: ['marriott'],
  cash: ['bizOne'],
}
export const ALWAYS_CANDIDATES: CardId[] = ['air', 'mercard']

/** 規約改定で変わる前提 */
export const RULES = {
  mercard: { monthlyPointCap: 5_000 },
  amex: {
    bonusPayees: ['amazon', 'yshop', 'yauc'] as Payee[],
    bonusSpendCapYen: 5_000_000,
    anaMileCap: 40_000,
    /** ANA上限を超えたMRポイントを他社マイルに移す率 */
    overflowMileRate: 0.8,
  },
  saison: { mileSpendCapYen: 15_000_000 },
  marriott: {
    blockPoints: 60_000,
    blockMiles: 25_000,
    freeNightSpendYen: 4_000_000,
  },
  ocBank: { rate: 0.021, endDate: '2026-12-31' },
} as const

export interface Assumptions {
  mileValue: number
  marriottPointValue: number
  mercardRate: number
  freeNightValue: number
  ocBankTransfer: boolean
  /** Airカードの利用枠（総枠・円） */
  airLimit: number
  /** ANAに移せない分のMRポイントを、ANA以外の航空会社のマイルとして評価する */
  useOtherAirlines: boolean
}

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  mileValue: 2,
  marriottPointValue: 1,
  mercardRate: 0.04,
  freeNightValue: 60_000,
  ocBankTransfer: true,
  airLimit: 1_000_000,
  useOtherAirlines: true,
}

export const ASSUMPTION_OPTIONS = {
  mileValue: [1.5, 2, 3],
  marriottPointValue: [0.6, 0.8, 1, 1.2, 1.5],
  mercardRate: [0.01, 0.02, 0.03, 0.04],
  airLimit: [1_000_000, 2_000_000, 3_000_000, 4_000_000, 5_000_000],
}

export function totalFee(card: Card): number {
  return card.fees.reduce((sum, f) => sum + f.amount, 0)
}

/** 候補から外したカード（注意点で理由を説明） */
export const EXCLUDED_CARDS: { name: string; reason: string }[] = [
  { name: 'dカード GOLD', reason: 'メルカリ特約店は2022年に終了。メルカリのdポイント還元は2024年11月に0.1%へ' },
  { name: 'ANAアメックス、ヒルトン・アメックス、デルタ・アメックス', reason: '送料などの事業用決済がポイント対象外' },
  { name: 'ANA VISA／マスターの法人カード', reason: 'カード会社のポイントをマイルに移行できない' },
  { name: 'ラグジュアリーカード', reason: '還元1.25%でAirカードより低く、年会費が高い' },
  // TODO(要確認): マネーフォワード ビジネスカードの月間利用ボーナス表
  { name: 'マネーフォワード ビジネスカード', reason: '通常1%＋月間利用ボーナス。ボーナス表を確認できるまで保留' },
]

/** 利用枠・特典で選ぶカード（計算では自動選択しない） */
export const PERK_CARD_NOTES: Partial<Record<CardId, string>> = {
  anaDiners: '還元率はANA JCB法人カードと同じ1%。利用枠に一律の制限がないのが強みで、支払いが大きく利用枠が足りない人向け。',
  anaJcbWide: '移行手数料が無料で継続2,000マイル。空港ラウンジなどの特典を使う人向け。',
  bizGold: '3倍の対象とANAへの移行上限はグリーンと同じ。還元面ではグリーンで十分なので、特典や入会キャンペーンを重視する人向け。',
  upsider: '年会費無料・還元1%。最大10億円の利用枠があり、Airカードの利用枠が足りない分の受け皿に。',
}
