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

export type AllocTarget = CardId | 'ocBank'

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

const isNonLinear = (card: Card) => card.currency === 'mr' || card.currency === 'marriott'

export function rateOf(cardId: CardId, payee: Payee, a: Assumptions): number {
  const card = CARDS[cardId]
  if (cardId === 'mercard' && payee === 'mercari') return a.mercardRate
  return card.payeeRates?.[payee] ?? card.baseRate
}

/** 貪欲法で使う「1単位あたりの円」。非線形のカードは近似値 */
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

function linearValue(cardId: CardId, payee: Payee, ctx: Context): number {
  return rateOf(cardId, payee, ctx.assumptions) * unitValue(CARDS[cardId], ctx)
}

/** 支払い先について、除外カード以外で一番得なカード（なければ null） */
function bestCard(cardIds: CardId[], payee: Payee, ctx: Context, exclude: CardId[] = [], linearOnly = false): CardId | null {
  let best: CardId | null = null
  let bestVal = 0
  for (const id of cardIds) {
    if (exclude.includes(id)) continue
    if (linearOnly && isNonLinear(CARDS[id])) continue
    const v = linearValue(id, payee, ctx)
    if (v > bestVal + 1e-12) {
      best = id
      bestVal = v
    }
  }
  return best
}

export function mrValue(points: number, ctx: Context): number {
  if (!ctx.goals.includes('ana')) return 0
  const V = ctx.assumptions.mileValue
  const { anaMileCap, overflowMileRate } = RULES.amex
  return Math.min(points, anaMileCap) * V + Math.max(0, points - anaMileCap) * overflowMileRate * V
}

/** マリオットのポイント価値（B案：マイルは60,000pt単位でのみ交換。端数はホテルで使えるときだけ評価） */
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

export type Assignment = Partial<Record<Payee, CardId>>

/** 割り当てを受け、上限（メルカード・セゾン）で溢れた分を次点へ回す */
export function allocateAmounts(cardIds: CardId[], assignment: Assignment, ctx: Context): Allocation[] {
  const out: Allocation[] = []
  const a = ctx.assumptions
  const push = (payee: Payee, cardId: AllocTarget, amount: number) => {
    if (amount > 0) out.push({ payee, cardId, amount, units: 0, value: 0 })
  }
  const overflow = (payee: Payee, amount: number, from: CardId) => {
    const next = bestCard(cardIds, payee, ctx, [from])
    if (next) push(payee, next, amount)
  }

  let saisonLeft: number = RULES.saison.mileSpendCapYen
  for (const payee of PAYEES) {
    const amount = ctx.spend[payee]
    if (amount <= 0) continue
    if (payee === 'oc' && ctx.ocBankActive) {
      push(payee, 'ocBank', amount)
      continue
    }
    const cardId = assignment[payee]
    if (!cardId) continue
    if (cardId === 'mercard' && payee === 'mercari') {
      const cap = (RULES.mercard.monthlyPointCap * 12) / a.mercardRate
      push(payee, cardId, Math.min(amount, cap))
      if (amount > cap) overflow(payee, amount - cap, cardId)
    } else if (cardId === 'saison') {
      const take = Math.min(amount, saisonLeft)
      saisonLeft -= take
      push(payee, cardId, take)
      if (amount > take) overflow(payee, amount - take, cardId)
    } else {
      push(payee, cardId, amount)
    }
  }
  return out
}

/** 割り当てごとのポイント数（アメックスの3倍は年500万円まで） */
function unitsOf(allocs: Allocation[], a: Assumptions): number[] {
  let bonusLeft: number = RULES.amex.bonusSpendCapYen
  return allocs.map((al) => {
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

/** カード単位の合計ポイントを円に換算する */
function cardValue(id: AllocTarget, units: number, ctx: Context): number {
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

/** 探索用の高速版：年会費を引いた合計だけを返す（valuate().net と一致させる） */
export function quickNet(allocs: Allocation[], ctx: Context, fixed: { fees: number; bonus: number }): number {
  const units = unitsOf(allocs, ctx.assumptions)
  const byCard = new Map<AllocTarget, number>()
  let marriottNonShipping = 0
  allocs.forEach((al, i) => {
    byCard.set(al.cardId, (byCard.get(al.cardId) ?? 0) + units[i])
    if (al.cardId === 'marriott' && !SHIPPING_PAYEES.includes(al.payee)) marriottNonShipping += al.amount
  })
  let gross = 0
  byCard.forEach((u, id) => (gross += cardValue(id, u, ctx)))
  const free = marriottNonShipping >= RULES.marriott.freeNightSpendYen ? ctx.assumptions.freeNightValue : 0
  return gross + fixed.bonus + free - fixed.fees
}

/** 割り当て済みの金額からポイント数と円換算を計算する */
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

  const marriottNonShipping = allocations
    .filter((x) => x.cardId === 'marriott' && !SHIPPING_PAYEES.includes(x.payee))
    .reduce((s, x) => s + x.amount, 0)
  const freeNight = marriottNonShipping >= RULES.marriott.freeNightSpendYen ? a.freeNightValue : 0

  // 各行の価値は、カード全体の価値をポイント数で按分
  const withValue = allocations.map((al) => {
    const t = totals[al.cardId]
    return { ...al, value: t.units > 0 ? (t.value * al.units) / t.units : 0 }
  })

  const gross = Object.values(totals).reduce((s, t) => s + t.value, 0)
  const { fees, bonus } = fixedCosts(cardIds, a)
  return { cardIds, allocations: withValue, totals, gross, fees, bonus, freeNight, net: gross + bonus + freeNight - fees }
}

/**
 * 組み合わせ内で最適な割り当てを探す。
 * 線形のカードは還元の高い方へ。アメックス（MR）とマリオットは上限・60,000pt単位があるため、
 * 支払い先ごとに「線形の最良 / アメックス / マリオット」を総当たりする。
 */
export function evaluateCardSet(cardIds: CardId[], ctx: Context): ComboEval {
  const nonLinear = cardIds.filter((id) => isNonLinear(CARDS[id]))
  const payees = PAYEES.filter((p) => ctx.spend[p] > 0 && !(p === 'oc' && ctx.ocBankActive))
  const options = payees.map((p) => {
    const linear = bestCard(cardIds, p, ctx, [], true)
    const linearVal = linear ? linearValue(linear, p, ctx) : 0
    const opts: (CardId | null)[] = [linear]
    for (const id of nonLinear) {
      const v = linearValue(id, p, ctx)
      // アメックスは上限で率が下がるだけなので、線形の最良以下なら選ぶ意味がない。
      // マリオットは無料宿泊（400万円）の達成で逆転しうるため残す
      const worth = CARDS[id].currency === 'mr' ? v > linearVal + 1e-12 : v > 0
      if (worth) opts.push(id)
    }
    return opts
  })

  const fixed = fixedCosts(cardIds, ctx.assumptions)
  let bestNet = -Infinity
  let bestAssignment: Assignment = {}
  const assignment: Assignment = {}
  const walk = (i: number) => {
    if (i === payees.length) {
      const net = quickNet(allocateAmounts(cardIds, assignment, ctx), ctx, fixed)
      if (net > bestNet + 1e-6) {
        bestNet = net
        bestAssignment = { ...assignment }
      }
      return
    }
    for (const opt of options[i]) {
      if (opt) assignment[payees[i]] = opt
      else delete assignment[payees[i]]
      walk(i + 1)
    }
  }
  walk(0)
  return valuate(cardIds, allocateAmounts(cardIds, bestAssignment, ctx), ctx)
}
