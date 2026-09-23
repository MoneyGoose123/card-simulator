// 損益分岐点（5-6）。数値は cards.ts から組み立て、mileValue に応じて動的に計算する。
import { CARDS, RULES, SHIPPING_PAYEES, totalFee, type Assumptions, type Goal, type Payee } from '../data/cards'
import { marriottValue } from './allocate'

export interface BreakevenRow {
  id: string
  name: string
  compare: string
  /** 分岐点（円）。null は「この前提では元が取れません」 */
  threshold: number | null
  userAmount: number
  amountLabel: string
  note?: string
}

const AIR_RATE = CARDS.air.baseRate
const AIR_FEE = totalFee(CARDS.air)

function linearThreshold(fixedCost: number, marginalRate: number): number | null {
  if (marginalRate <= 0) return null
  return Math.max(0, fixedCost / marginalRate)
}

/** マリオット：送料以外をAirカードで払う場合と比べ、元が取れる最小の年間額（1万円刻みで探索） */
export function marriottThreshold(a: Assumptions, goals: Goal[]): number | null {
  const valuationGoals: Goal[] = goals.some((g) => g === 'hotel' || g === 'ana' || g === 'jal') ? goals : ['hotel']
  const ctx = { spend: {} as Record<Payee, number>, goals: valuationGoals, assumptions: a, ocBankActive: false }
  const fee = totalFee(CARDS.marriott)
  for (let s = 10_000; s <= 200_000_000; s += 10_000) {
    const pts = Math.round(s * CARDS.marriott.baseRate)
    const free = s >= RULES.marriott.freeNightSpendYen ? a.freeNightValue : 0
    if (marriottValue(pts, ctx) + free - fee >= s * AIR_RATE) return s
  }
  return null
}

export function breakevens(spend: Record<Payee, number>, a: Assumptions, goals: Goal[]): BreakevenRow[] {
  const V = a.mileValue
  const total = Object.values(spend).reduce((s, v) => s + v, 0)
  const bonusTarget = RULES.amex.bonusPayees.reduce((s, p) => s + spend[p], 0)
  const nonShipping = Object.entries(spend)
    .filter(([p]) => !SHIPPING_PAYEES.includes(p as Payee))
    .reduce((s, [, v]) => s + v, 0)

  const jcb = CARDS.anaJcb
  const jcbBonus = jcb.annualBonusMiles ?? 0
  const premium = CARDS.anaDinersPremium
  const premiumBonus = premium.annualBonusMiles ?? 0
  const green = CARDS.bizGreen

  return [
    {
      id: 'bizGreen',
      name: 'ビジネス・グリーンを追加',
      compare: '3倍対象をAirカードで払う',
      threshold: linearThreshold(totalFee(green), 0.03 * V - AIR_RATE),
      userAmount: bonusTarget,
      amountLabel: 'Amazon・Yahoo!ショッピング・Yahoo!オークション',
      note: 'ANAマイルで使う場合（年4万マイルまで、ANA移行の年間参加費込み）',
    },
    {
      id: 'anaJcb',
      name: 'ANA JCB法人カード',
      compare: '全部Airカード',
      threshold: linearThreshold(totalFee(jcb) - AIR_FEE - jcbBonus * V, jcb.baseRate * V - AIR_RATE),
      userAmount: total,
      amountLabel: '支払いの合計',
      note: `継続${jcbBonus.toLocaleString('ja-JP')}マイル込み。込まない場合 ${fmtMan(linearThreshold(totalFee(jcb) - AIR_FEE, jcb.baseRate * V - AIR_RATE))}`,
    },
    {
      id: 'marriott',
      name: 'マリオット・プレミアム',
      compare: '送料以外をAirカードで払う',
      threshold: marriottThreshold(a, goals),
      userAmount: nonShipping,
      amountLabel: '送料以外の支払い',
      note: '無料宿泊（年400万円）込み。マイルは60,000pt単位で交換',
    },
    {
      id: 'saison',
      name: 'セゾンプラチナ・ビジネス',
      compare: '全部Airカード',
      threshold: linearThreshold(totalFee(CARDS.saison) - AIR_FEE, CARDS.saison.baseRate * V - AIR_RATE),
      userAmount: total,
      amountLabel: '支払いの合計',
      note: 'JALマイル加算は年1,500万円まで',
    },
    {
      id: 'anaDinersPremium',
      name: 'ANAダイナース プレミアム',
      compare: 'ANA JCB法人カード',
      threshold: linearThreshold(
        totalFee(premium) - totalFee(jcb) - (premiumBonus - jcbBonus) * V,
        (premium.baseRate - jcb.baseRate) * V,
      ),
      userAmount: total,
      amountLabel: '支払いの合計',
      note: '招待制',
    },
  ]
}

export function fmtMan(n: number | null): string {
  if (n === null) return 'この前提では元が取れません'
  return `約${Math.round(Math.round(n) / 10_000).toLocaleString('ja-JP')}万円`
}
