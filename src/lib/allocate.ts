// 1つのカードの組み合わせについて、支払い先の割り当てと円換算を行う純粋関数。
import {
  CARDS,
  PAYEES,
  RULES,
  SHIPPING_PAYEES,
  totalFee,
  type Assumptions,
  type Card,
  type CardId,
  type Goal,
  type Payee,
} from '../data/cards'

/** ocBank：オレンジコネックス銀行振込、none：組み合わせ内に還元のあるカードがない支払い */
export type AllocTarget = CardId | 'ocBank' | 'none'

export interface Allocation {
  payee: Payee
  cardId: AllocTarget
  amount: number
  units: number
  value: number
}

export interface Context {
  spend: Record<Payee, number>
  goals: Goal[]
  assumptions: Assumptions
  ocBankActive: boolean
}

export interface CardTotal {
  amount: number
  units: number
  value: number
}

export interface ComboEval {
  cardIds: CardId[]
  allocations: Allocation[]
  totals: Record<string, CardTotal>
  gross: number
  fees: number
  bonus: number
  freeNight: number
  net: number
}

type Amounts = Record<Payee, number>
type Draft = { payee: Payee; cardId: AllocTarget; amount: number }

const EPS = 1e-6

export function rateOf(cardId: CardId, payee: Payee, a: Assumptions): number {
  const card = CARDS[cardId]
  if (cardId === 'mercard' && payee === 'mercari') return a.mercardRate
  return card.payeeRates?.[payee] ?? card.baseRate
}

/** 線形のカードの「1単位あたりの円」。非線形のカード（MR・マリオット）は上限なしの近似値 */
export function unitValue(card: Card, ctx: Context): number {
  const { mileValue: V, marriottPointValue: pv } = ctx.assumptions
  const g = ctx.goals
  switch (card.currency) {
    case 'cash':
      return 1
    case 'ana':
    case 'jal':
      return V
    case 'mr':
      return g.includes('ana') ? V : 0
    case 'marriott': {
      const hotel = g.includes('hotel') ? pv : 0
      const mile = g.includes('ana') || g.includes('jal') ? (RULES.marriott.blockMiles / RULES.marriott.blockPoints) * V : 0
      return Math.max(hotel, mile)
    }
  }
}

export function mrValue(points: number, ctx: Context): number {
  if (!ctx.goals.includes('ana')) return 0
  const { mileValue: V, useOtherAirlines } = ctx.assumptions
  const { anaMileCap, overflowMileRate } = RULES.amex
  const overflow = useOtherAirlines ? Math.max(0, points - anaMileCap) * overflowMileRate * V : 0
  return Math.min(points, anaMileCap) * V + overflow
}

/** マリオットのポイント価値（マイルは60,000pt単位でのみ交換。端数はホテルで使えるときだけ評価） */
export function marriottValue(points: number, ctx: Context): number {
  const { mileValue: V, marriottPointValue: pv } = ctx.assumptions
  const hotel = ctx.goals.includes('hotel')
  const miles = ctx.goals.includes('ana') || ctx.goals.includes('jal')
  const { blockPoints, blockMiles } = RULES.marriott
  const hotelVal = hotel ? points * pv : 0
  const blocks = Math.floor(points / blockPoints)
  const mileVal = miles ? blocks * blockMiles * V + (hotel ? (points - blocks * blockPoints) * pv : 0) : 0
  return Math.max(hotelVal, mileVal)
}

export function marriottMiles(points: number): number {
  return Math.floor(points / RULES.marriott.blockPoints) * RULES.marriott.blockMiles
}

// ---------------------------------------------------------------- 割り当て

/** 年間の上限（円）。メルカードはメルカリ分のみ */
function capYen(cardId: CardId, payee: Payee, a: Assumptions): number {
  if (cardId === 'mercard' && payee === 'mercari') return (RULES.mercard.monthlyPointCap * 12) / a.mercardRate
  if (cardId === 'saison') return RULES.saison.mileSpendCapYen
  return Infinity
}
/** 上限を共有する単位（セゾンは全支払い先で共通、メルカードはメルカリだけ） */
const capKey = (cardId: CardId, payee: Payee) => (cardId === 'mercard' ? `mercard:${payee === 'mercari' ? 'mercari' : 'other'}` : cardId)

function linearValue(cardId: CardId, payee: Payee, ctx: Context): number {
  return rateOf(cardId, payee, ctx.assumptions) * unitValue(CARDS[cardId], ctx)
}

/**
 * 線形のカードへの割り当て。還元の高い（支払い先・カード）から順に、カードごとの残り上限を共通管理して埋める。
 * 同じ還元なら、次点の還元が低い支払い先を優先する（上限のあるカードを一番必要な支払い先に回す）。
 */
function allocateLinear(linear: CardId[], rem: Amounts, ctx: Context): Draft[] {
  const a = ctx.assumptions
  const pairs: { payee: Payee; cardId: CardId; v: number; second: number }[] = []
  for (const payee of PAYEES) {
    if (rem[payee] <= EPS) continue
    const vals = linear.map((id) => ({ id, v: linearValue(id, payee, ctx) })).filter((x) => x.v > 0)
    const sorted = [...vals].sort((x, y) => y.v - x.v)
    for (const { id, v } of vals) {
      const second = sorted.find((x) => x.id !== id)?.v ?? 0
      pairs.push({ payee, cardId: id, v, second })
    }
  }
  pairs.sort((x, y) => y.v - x.v || x.second - y.second)

  const left = { ...rem }
  const capLeft = new Map<string, number>()
  const out: Draft[] = []
  for (const { payee, cardId } of pairs) {
    if (left[payee] <= EPS) continue
    const key = capKey(cardId, payee)
    const cap = capLeft.get(key) ?? capYen(cardId, payee, a)
    const take = Math.min(left[payee], cap)
    if (take <= EPS) continue
    out.push({ payee, cardId, amount: take })
    left[payee] -= take
    capLeft.set(key, cap - take)
  }
  for (const payee of PAYEES) if (left[payee] > EPS) out.push({ payee, cardId: 'none', amount: left[payee] })
  return out
}

/** 非線形のカードに寄せる順番（区間）。同じ区間の中は線形の代替が低い支払い先から */
function segmentsFor(cardId: CardId, rem: Amounts, alt: Amounts, ctx: Context): { payee: Payee; amount: number }[] {
  const a = ctx.assumptions
  const eligible = PAYEES.filter((p) => rem[p] > EPS && rateOf(cardId, p, a) > 0).sort((x, y) => alt[x] - alt[y])
  if (CARDS[cardId].currency !== 'mr') return eligible.map((p) => ({ payee: p, amount: rem[p] }))
  // アメックス：3倍の対象を上限まで先に、残りは代替の低い順
  const left = { ...rem }
  const segs: { payee: Payee; amount: number }[] = []
  let bonusLeft: number = RULES.amex.bonusSpendCapYen
  for (const p of eligible.filter((x) => RULES.amex.bonusPayees.includes(x))) {
    const take = Math.min(left[p], bonusLeft)
    if (take > EPS) segs.push({ payee: p, amount: take })
    left[p] -= take
    bonusLeft -= take
  }
  for (const p of eligible) if (left[p] > EPS) segs.push({ payee: p, amount: left[p] })
  return segs
}

/** 寄せる金額の候補：区間の区切り、ANA移行上限・60,000pt単位・無料宿泊400万円の境目 */
function loadCandidates(cardId: CardId, segs: { payee: Payee; amount: number }[], ctx: Context): number[] {
  const a = ctx.assumptions
  const out = new Set<number>([0])
  let cum = 0
  let pts = 0
  const card = CARDS[cardId]
  const ptsTargets: number[] = []
  if (card.currency === 'mr') ptsTargets.push(RULES.amex.anaMileCap)
  let bonusLeft: number = RULES.amex.bonusSpendCapYen
  for (const s of segs) {
    const bonus = card.currency === 'mr' && RULES.amex.bonusPayees.includes(s.payee) ? Math.min(s.amount, bonusLeft) : 0
    const rate = bonus > 0 ? rateOf(cardId, s.payee, a) : card.baseRate
    bonusLeft -= bonus
    for (const target of ptsTargets) {
      if (pts < target && pts + s.amount * rate >= target) out.add(cum + (target - pts) / rate)
    }
    cum += s.amount
    pts += s.amount * rate
    out.add(cum)
  }
  if (card.currency === 'marriott') {
    const blockYen = RULES.marriott.blockPoints / card.baseRate
    for (let y = blockYen; y <= cum + EPS; y += blockYen) out.add(y)
    if (RULES.marriott.freeNightSpendYen <= cum) out.add(RULES.marriott.freeNightSpendYen)
  }
  // 円未満の端数は丸める（割り算の誤差で60,000ptに届かない等を防ぐ）
  return [...new Set([...out].map((x) => Math.min(Math.round(x), Math.round(cum))))]
}

function takeFromSegments(cardId: CardId, segs: { payee: Payee; amount: number }[], load: number, rem: Amounts): { drafts: Draft[]; rem: Amounts } {
  const left = { ...rem }
  const drafts: Draft[] = []
  let need = load
  for (const s of segs) {
    if (need <= EPS) break
    const take = Math.min(s.amount, need, left[s.payee])
    if (take <= EPS) continue
    drafts.push({ payee: s.payee, cardId, amount: take })
    left[s.payee] -= take
    need -= take
  }
  return { drafts, rem: left }
}

/** 同じ支払い先・カードの行をまとめる（表示順は PAYEES 順） */
function merge(drafts: Draft[]): Allocation[] {
  const map = new Map<string, Allocation>()
  for (const d of drafts) {
    const key = `${d.payee}|${d.cardId}`
    const prev = map.get(key)
    map.set(key, { payee: d.payee, cardId: d.cardId, amount: (prev?.amount ?? 0) + d.amount, units: 0, value: 0 })
  }
  return [...map.values()].sort((x, y) => PAYEES.indexOf(x.payee) - PAYEES.indexOf(y.payee))
}

// ---------------------------------------------------------------- 評価

/** 割り当てごとのポイント数（アメックスの3倍は年500万円まで） */
function unitsOf(allocs: Allocation[], a: Assumptions): number[] {
  let bonusLeft: number = RULES.amex.bonusSpendCapYen
  return allocs.map((al) => {
    if (al.cardId === 'none') return 0
    if (al.cardId === 'ocBank') return Math.round(al.amount * RULES.ocBank.rate)
    const card = CARDS[al.cardId]
    if (card.currency === 'mr' && RULES.amex.bonusPayees.includes(al.payee)) {
      const bonusPart = Math.min(al.amount, bonusLeft)
      bonusLeft -= bonusPart
      return Math.round(bonusPart * rateOf(al.cardId, al.payee, a) + (al.amount - bonusPart) * card.baseRate)
    }
    return Math.round(al.amount * rateOf(al.cardId, al.payee, a))
  })
}

function cardValue(id: AllocTarget, units: number, ctx: Context): number {
  if (id === 'none') return 0
  if (id === 'ocBank') return units
  const card = CARDS[id]
  if (card.currency === 'mr') return mrValue(units, ctx)
  if (card.currency === 'marriott') return marriottValue(units, ctx)
  return units * unitValue(card, ctx)
}

export function fixedCosts(cardIds: CardId[], a: Assumptions): { fees: number; bonus: number } {
  return {
    fees: cardIds.reduce((s, id) => s + totalFee(CARDS[id]), 0),
    bonus: cardIds.reduce((s, id) => s + (CARDS[id].annualBonusMiles ?? 0) * a.mileValue, 0),
  }
}

const marriottNonShipping = (allocs: Allocation[]) =>
  allocs.filter((x) => x.cardId === 'marriott' && !SHIPPING_PAYEES.includes(x.payee)).reduce((s, x) => s + x.amount, 0)

/** 探索用の高速版：年会費を引いた合計だけを返す（valuate().net と一致させる） */
export function quickNet(allocs: Allocation[], ctx: Context, fixed: { fees: number; bonus: number }): number {
  const units = unitsOf(allocs, ctx.assumptions)
  const byCard = new Map<AllocTarget, number>()
  allocs.forEach((al, i) => byCard.set(al.cardId, (byCard.get(al.cardId) ?? 0) + units[i]))
  let gross = 0
  byCard.forEach((u, id) => (gross += cardValue(id, u, ctx)))
  const free = marriottNonShipping(allocs) >= RULES.marriott.freeNightSpendYen ? ctx.assumptions.freeNightValue : 0
  return gross + fixed.bonus + free - fixed.fees
}

export function valuate(cardIds: CardId[], allocs: Allocation[], ctx: Context): ComboEval {
  const a = ctx.assumptions
  const units = unitsOf(allocs, a)
  const allocations = allocs.map((al, i) => ({ ...al, units: units[i] }))

  const totals: Record<string, CardTotal> = {}
  for (const al of allocations) {
    const prev = totals[al.cardId] ?? { amount: 0, units: 0, value: 0 }
    totals[al.cardId] = { ...prev, amount: prev.amount + al.amount, units: prev.units + al.units }
  }
  for (const [id, t] of Object.entries(totals)) totals[id] = { ...t, value: cardValue(id as AllocTarget, t.units, ctx) }

  const freeNight = marriottNonShipping(allocations) >= RULES.marriott.freeNightSpendYen ? a.freeNightValue : 0
  // 各行の価値は、カード全体の価値をポイント数で按分
  const withValue = allocations.map((al) => {
    const t = totals[al.cardId]
    return { ...al, value: t.units > 0 ? (t.value * al.units) / t.units : 0 }
  })
  const gross = Object.values(totals).reduce((s, t) => s + t.value, 0)
  const { fees, bonus } = fixedCosts(cardIds, a)
  return { cardIds, allocations: withValue, totals, gross, fees, bonus, freeNight, net: gross + bonus + freeNight - fees }
}

/** 組み合わせ内のすべての割り当て候補を列挙する（テスト用にも公開） */
export function candidatePlans(cardIds: CardId[], ctx: Context): Allocation[][] {
  const base: Draft[] = []
  const rem = { ...ctx.spend }
  if (ctx.ocBankActive && rem.oc > 0) {
    base.push({ payee: 'oc', cardId: 'ocBank', amount: rem.oc })
    rem.oc = 0
  }
  const linear = cardIds.filter((id) => !['mr', 'marriott'].includes(CARDS[id].currency))
  const nonLinear = cardIds.filter((id) => ['mr', 'marriott'].includes(CARDS[id].currency))
  const alt = Object.fromEntries(
    PAYEES.map((p) => [p, Math.max(0, ...linear.map((id) => linearValue(id, p, ctx)))]),
  ) as Amounts

  const plans: Allocation[][] = []
  const orders = nonLinear.length === 2 ? [nonLinear, [...nonLinear].reverse()] : [nonLinear]
  const walk = (order: CardId[], i: number, r: Amounts, acc: Draft[]) => {
    if (i === order.length) {
      plans.push(merge([...base, ...acc, ...allocateLinear(linear, r, ctx)]))
      return
    }
    const segs = segmentsFor(order[i], r, alt, ctx)
    for (const load of loadCandidates(order[i], segs, ctx)) {
      const { drafts, rem: next } = takeFromSegments(order[i], segs, load, r)
      walk(order, i + 1, next, [...acc, ...drafts])
    }
  }
  for (const order of orders) walk(order, 0, rem, [])
  return plans
}

/**
 * 組み合わせ内で最適な割り当てを探す。
 * アメックス（MR）とマリオットは上限・60,000pt単位・無料宿泊があるため、
 * 「いくら寄せるか」を境目の金額で総当たりし、残りを線形のカードに割り当てる。
 */
export function evaluateCardSet(cardIds: CardId[], ctx: Context): ComboEval {
  const fixed = fixedCosts(cardIds, ctx.assumptions)
  let best: Allocation[] = []
  let bestNet = -Infinity
  for (const plan of candidatePlans(cardIds, ctx)) {
    const net = quickNet(plan, ctx, fixed)
    if (net > bestNet + EPS) {
      bestNet = net
      best = plan
    }
  }
  return valuate(cardIds, best, ctx)
}
