// カード選びシミュレーターの計算本体（純粋関数）。
import {
  ALWAYS_CANDIDATES,
  DEFAULT_ASSUMPTIONS,
  CARDS,
  GOAL_CANDIDATES,
  GOAL_LABELS,
  MAX_GOALS,
  RULES,
  SHIPPING_PAYEES,
  type Assumptions,
  type CardId,
  type Currency,
  type Goal,
  type Payee,
} from '../data/cards'
import { evaluateCardSet, marriottMiles, type ComboEval, type Context } from './allocate'

export type Entity = 'corp' | 'sole'

export interface SimInput {
  spend: Record<Payee, number>
  goals: Goal[]
  entity: Entity
  assumptions: Assumptions
  /** YYYY-MM-DD。オレンジコネックス銀行振込の期間判定に使う */
  today?: string
}

export interface Warning {
  id: string
  message: string
}

export interface BreakdownRow {
  key: 'cash' | 'ana' | 'jal' | 'marriott' | 'otherAirline'
  label: string
  amount: number
  unit: string
  note?: string
}

export interface ComboResult extends ComboEval {
  breakdown: BreakdownRow[]
  warnings: Warning[]
}

export interface SimResult {
  goals: Goal[]
  candidates: CardId[]
  ocBankActive: boolean
  best: ComboResult
  allAir: ComboResult
  cashTrio: ComboResult
  warnings: Warning[]
  skippedGoals: { goal: Goal; reason: string }[]
}

const yen = (n: number) => `${Math.round(n).toLocaleString('ja-JP')}円`
const man = (n: number) => `${Math.ceil(n / 10_000).toLocaleString('ja-JP')}万円`

export function todayString(): string {
  return new Date().toISOString().slice(0, 10)
}

export function isOcBankActive(a: Assumptions, today: string): boolean {
  return a.ocBankTransfer && today <= RULES.ocBank.endDate
}

function contextOf(input: SimInput): Context {
  return {
    spend: input.spend,
    goals: input.goals.length ? input.goals : ['cash'],
    assumptions: input.assumptions,
    ocBankActive: isOcBankActive(input.assumptions, input.today ?? todayString()),
  }
}

export function toggleGoal(goals: Goal[], goal: Goal): { goals: Goal[]; error?: string } {
  if (goals.includes(goal)) return { goals: goals.filter((g) => g !== goal) }
  if (goals.length >= MAX_GOALS) return { goals, error: `${MAX_GOALS}つまで選べます` }
  return { goals: [...goals, goal] }
}

export function candidatesFor(goals: Goal[], entity: Entity, a: Assumptions = DEFAULT_ASSUMPTIONS): CardId[] {
  const ids = [...goals.flatMap((g) => GOAL_CANDIDATES[g]), ...ALWAYS_CANDIDATES]
  return [...new Set(ids)].filter((id) => {
    const c = CARDS[id]
    return c.roles.includes('core') && (entity === 'corp' || !c.corpOnly)
      && (id !== 'anaJcbPersonal' || entity === 'sole') && (!c.inviteOnly || a.allowInviteOnly)
  })
}

function subsets(ids: CardId[]): CardId[][] {
  const out: CardId[][] = []
  for (let mask = 0; mask < 1 << ids.length; mask++) {
    const set = ids.filter((_, i) => mask & (1 << i))
    const groups = set.map((id) => CARDS[id].exclusiveGroup).filter(Boolean)
    if (new Set(groups).size === groups.length) out.push(set)
  }
  return out
}

function searchBest(ids: CardId[], ctx: Context, filter: (set: CardId[]) => boolean = () => true): ComboEval | null {
  let best: ComboEval | null = null
  for (const set of subsets(ids)) {
    if ((ctx.assumptions.maxCards > 0 && set.length > ctx.assumptions.maxCards) || !filter(set)) continue
    const ev = evaluateCardSet(set, ctx)
    if (!best || ev.net > best.net + 1e-6 || (Math.abs(ev.net - best.net) <= 1e-6 && set.length < best.cardIds.length)) {
      best = ev
    }
  }
  return best
}

const GOAL_CURRENCIES: Record<Goal, Currency[]> = {
  ana: ['ana', 'mr', 'marriott'],
  jal: ['jal', 'marriott'],
  hotel: ['marriott'],
  cash: ['cash'],
}
const servesGoal = (set: CardId[], goal: Goal) => set.some((id) => GOAL_CURRENCIES[goal].includes(CARDS[id].currency))

function breakdownOf(ev: ComboEval, ctx: Context): BreakdownRow[] {
  const rows = new Map<BreakdownRow['key'], BreakdownRow>()
  const add = (key: BreakdownRow['key'], label: string, amount: number, unit: string, note?: string) => {
    const prev = rows.get(key)
    rows.set(key, { key, label, unit, amount: (prev?.amount ?? 0) + amount, note: note ?? prev?.note })
  }
  for (const [id, t] of Object.entries(ev.totals)) {
    if (id === 'none') continue
    if (id === 'ocBank') {
      add('cash', '現金', t.units, '円')
      continue
    }
    const cur = CARDS[id].currency
    if (cur === 'cash') add('cash', '現金', t.units, '円')
    else if (cur === 'ana') add('ana', 'ANAマイル', t.units, 'マイル')
    else if (cur === 'jal') add('jal', 'JALマイル', t.units, 'マイル')
    else if (cur === 'mr') {
      const toAna = Math.min(t.units, RULES.amex.anaMileCap)
      add('ana', 'ANAマイル', toAna, 'マイル')
      if (t.units > toAna) {
        if (ctx.assumptions.useOtherAirlines) {
          add('otherAirline', '他社マイル（ANA以外）', Math.round((t.units - toAna) * RULES.amex.overflowMileRate), 'マイル')
        } else {
          add('otherAirline', 'ANAに移せないポイント', t.units - toAna, 'pt', '価値0円で計算（他社マイルは使わない設定）')
        }
      }
    } else if (cur === 'marriott') {
      const miles = marriottMiles(t.units)
      const mileGoal = ctx.goals.includes('ana') || ctx.goals.includes('jal')
      add('marriott', 'マリオットポイント', t.units, 'pt', mileGoal ? `マイルに移すと ${miles.toLocaleString('ja-JP')}マイル（60,000pt単位）` : undefined)
    }
  }
  for (const id of ev.cardIds) {
    const miles = CARDS[id].annualBonusMiles
    if (miles) add(CARDS[id].currency === 'jal' ? 'jal' : 'ana', CARDS[id].currency === 'jal' ? 'JALマイル' : 'ANAマイル', miles, 'マイル')
  }
  // 選んだ目的の行は0でも表示する
  const goalKey: Record<Goal, BreakdownRow['key']> = { ana: 'ana', jal: 'jal', hotel: 'marriott', cash: 'cash' }
  const goalLabel: Record<Goal, [string, string]> = {
    ana: ['ANAマイル', 'マイル'],
    jal: ['JALマイル', 'マイル'],
    hotel: ['マリオットポイント', 'pt'],
    cash: ['現金', '円'],
  }
  for (const g of ctx.goals) if (!rows.has(goalKey[g])) add(goalKey[g], goalLabel[g][0], 0, goalLabel[g][1])
  return [...rows.values()]
}

function comboWarnings(ev: ComboEval, ctx: Context): Warning[] {
  const w: Warning[] = []
  const a = ctx.assumptions
  const t = ev.totals
  const mr = (t.bizGreen?.units ?? 0) + (t.bizGold?.units ?? 0)
  if (mr > RULES.amex.anaMileCap) {
    w.push({ id: 'amexAnaCap', message: `アメックスで年${mr.toLocaleString('ja-JP')}ポイント貯まります。ANAへ移行できるのは年4万マイルまでで、残りはANA以外の航空会社のマイルに移すか翌年に回します。` })
  }
  const bonusSpend = ev.allocations
    .filter((x) => (x.cardId === 'bizGreen' || x.cardId === 'bizGold') && RULES.amex.bonusPayees.includes(x.payee))
    .reduce((s, x) => s + x.amount, 0)
  if (bonusSpend > RULES.amex.bonusSpendCapYen) {
    w.push({ id: 'amexBonusCap', message: '3倍の対象は年500万円までです。超えた分は3倍になりません（1倍）。' })
  }
  const saisonEligible = Object.entries(ctx.spend).reduce((sum, [p, v]) => sum + (p === 'oc' && ctx.ocBankActive ? 0 : v), 0)
  if ((t.saison?.amount ?? 0) >= RULES.saison.mileSpendCapYen - 1 && saisonEligible > RULES.saison.mileSpendCapYen) {
    w.push({ id: 'saisonCap', message: 'セゾンのJALマイル加算は年1,500万円までです。超えた分は別のカードで計算しています。' })
  }
  const merc = ev.allocations.find((x) => x.payee === 'mercari' && x.cardId === 'mercard')?.amount ?? 0
  const mercCap = (RULES.mercard.monthlyPointCap * a.mercariMonths) / a.mercardRate
  if (merc > 0 && merc >= mercCap - 1 && ctx.spend.mercari > merc + 1) {
    w.push({ id: 'mercardCap', message: `メルカードのメルカリ還元は月5,000ポイントまでです。${a.mercariMonths}ヶ月に均等に使う前提で、年${man(mercCap)}を超えた分は別のカードで計算しています。` })
  }
  const airMonthly = (t.air?.amount ?? 0) / 12
  if (airMonthly > a.airLimit) {
    w.push({ id: 'airLimit', message: `Airカードの支払いが月平均${man(airMonthly)}で、利用枠（総枠${man(a.airLimit)}）を超えそうです。利用枠は支払い前の残高も含む総枠なので、実際はもっと早く足りなくなることがあります。この計算は利用枠を考慮しない参考計算です。超える分はUPSIDER（年会費無料・1%・大きな利用枠）か、利用枠に一律の制限がないアメックス・ダイナースを検討してください。` })
  }
  return w
}

function toResult(ev: ComboEval, ctx: Context): ComboResult {
  return { ...ev, breakdown: breakdownOf(ev, ctx), warnings: comboWarnings(ev, ctx) }
}

/** 指定したカードの組み合わせを評価する（比較・テスト用） */
export function evaluateCombo(cardIds: CardId[], input: SimInput): ComboResult {
  const ctx = contextOf(input)
  return toResult(evaluateCardSet(cardIds, ctx), ctx)
}

function resultWarnings(best: ComboResult, cashTrio: ComboResult, ctx: Context, input: SimInput): Warning[] {
  const w = [...best.warnings]
  const has = (id: CardId) => best.cardIds.includes(id)
  if (has('anaDinersPremium')) {
    w.push({ id: 'premiumInvite', message: 'ANAダイナース プレミアムは招待制です。招待を受けている場合の比較です。発行・利用条件はカード会社に確認してください。' })
  }
  if (has('anaJcbPersonal') && input.entity === 'sole') {
    w.push({ id: 'anaJcbPersonal', message: '個人向けANA JCBは、事業の支払いに使えるか・引落口座の条件を発行会社に確認してください。法人カードとは別の年会費で計算しています。' })
  }
  if (has('marriott')) {
    const nonShipping = best.allocations
      .filter((x) => x.cardId === 'marriott' && !SHIPPING_PAYEES.includes(x.payee))
      .reduce((s, x) => s + x.amount, 0)
    if (nonShipping < RULES.marriott.freeNightSpendYen) {
      w.push({ id: 'marriottFreeNightGap', message: `マリオットの無料宿泊の条件（年400万円）まで、あと${man(RULES.marriott.freeNightSpendYen - nonShipping)}です。` })
    }
    w.push({ id: 'marriottMerchant', message: '仕入れ先がアメックスの「事業用加盟店」に登録されると、マリオットのポイントが0になる場合があります（送料は0ポイントです）。' })
  }
  const nonCash = ctx.goals.filter((g) => g !== 'cash')
  if (nonCash.length > 0 && !nonCash.some((g) => servesGoal(best.cardIds, g)) && cashTrio.net >= best.net - 1e-6) {
    w.push({ id: 'cashBetter', message: `今の支払い額では、${nonCash.map((g) => GOAL_LABELS[g]).join('・')}のカードより現金派の組み合わせの方が得です。支払いが増えるまでは現金派で。` })
  }
  return w
}

export function simulate(input: SimInput): SimResult {
  const ctx = contextOf(input)
  const candidates = candidatesFor(ctx.goals, input.entity, ctx.assumptions)
  const best = toResult(searchBest(candidates, ctx)!, ctx)
  // 「全部Airカード」は表示名どおり銀行振込を使わない
  const airCtx = { ...ctx, ocBankActive: false }
  const allAir = toResult(evaluateCardSet(['air'], airCtx), airCtx)
  const cashIds: CardId[] = ['air', 'mercard', 'bizOne']
  const cashTrio = toResult(searchBest(cashIds, { ...ctx, goals: ['cash'] })!, ctx)

  const skippedGoals: SimResult['skippedGoals'] = []
  if (ctx.goals.length > 1) {
    for (const g of ctx.goals) {
      if (servesGoal(best.cardIds, g)) continue
      const alt = searchBest(candidates, ctx, (set) => servesGoal(set, g))
      const names = alt?.cardIds.filter((id) => GOAL_CURRENCIES[g].includes(CARDS[id].currency)).map((id) => CARDS[id].name)
      skippedGoals.push({
        goal: g,
        reason: alt
          ? best.net - alt.net > 1
            ? `${GOAL_LABELS[g]}のカード（${names?.join('、')}）を入れると、年会費を引いた合計が${yen(best.net - alt.net)}少なくなるため採用していません。`
            : `${GOAL_LABELS[g]}のカードを増やしても合計価値が変わらないため、枚数の少ない組み合わせを選びました。`
          : `${GOAL_LABELS[g]}のカードで得になる支払いがないため採用していません。`,
      })
    }
  }

  return {
    goals: ctx.goals,
    candidates,
    ocBankActive: ctx.ocBankActive,
    best,
    allAir,
    cashTrio,
    warnings: resultWarnings(best, cashTrio, ctx, input),
    skippedGoals,
  }
}
