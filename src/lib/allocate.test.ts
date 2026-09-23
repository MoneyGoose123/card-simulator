import { describe, expect, it } from 'vitest'
import { DEFAULT_ASSUMPTIONS, PAYEES, RULES, type CardId, type Goal, type Payee } from '../data/cards'
import { candidatePlans, evaluateCardSet, fixedCosts, quickNet, valuate, type Context } from './allocate'

// 疑似乱数（再現性のため固定シード）
function rng(seed: number) {
  return () => ((seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31)
}

const CARD_POOL: CardId[] = ['air', 'mercard', 'bizOne', 'anaJcb', 'anaDinersPremium', 'bizGreen', 'saison', 'marriott']
const GOAL_SETS: Goal[][] = [['ana'], ['jal'], ['hotel'], ['cash'], ['ana', 'hotel'], ['ana', 'jal']]

function randomCases(n: number) {
  const rand = rng(42)
  return Array.from({ length: n }, (_, i) => {
    const spend = Object.fromEntries(PAYEES.map((p) => [p, rand() < 0.3 ? 0 : Math.round(rand() * 2000) * 10_000])) as Record<Payee, number>
    const ctx: Context = {
      spend,
      goals: GOAL_SETS[i % GOAL_SETS.length],
      assumptions: { ...DEFAULT_ASSUMPTIONS, mileValue: [1.5, 2, 3][i % 3], useOtherAirlines: i % 4 !== 0 },
      ocBankActive: i % 2 === 0,
    }
    return { ctx, cardIds: CARD_POOL.filter(() => rand() < 0.5) }
  })
}

describe('割り当ての不変条件（ランダム200件）', () => {
  const cases = randomCases(200)

  it('どの割り当て候補も、支払い先ごとの合計が入力と一致し、上限を超えない', () => {
    for (const { ctx, cardIds } of cases) {
      for (const plan of candidatePlans(cardIds, ctx)) {
        for (const p of PAYEES) {
          const sum = plan.filter((a) => a.payee === p).reduce((s, a) => s + a.amount, 0)
          expect(Math.abs(sum - ctx.spend[p])).toBeLessThan(1)
        }
        const saison = plan.filter((a) => a.cardId === 'saison').reduce((s, a) => s + a.amount, 0)
        expect(saison).toBeLessThanOrEqual(RULES.saison.mileSpendCapYen + 1)
        const merc = plan.filter((a) => a.cardId === 'mercard' && a.payee === 'mercari').reduce((s, a) => s + a.amount, 0)
        expect(merc).toBeLessThanOrEqual((RULES.mercard.monthlyPointCap * 12) / ctx.assumptions.mercardRate + 1)
        expect(plan.every((a) => a.cardId === 'none' || a.cardId === 'ocBank' || cardIds.includes(a.cardId))).toBe(true)
      }
    }
  })

  it('探索用の高速版と詳細版の net が一致する', () => {
    for (const { ctx, cardIds } of cases) {
      const plans = candidatePlans(cardIds, ctx)
      const plan = plans[plans.length - 1]
      expect(quickNet(plan, ctx, fixedCosts(cardIds, ctx.assumptions))).toBeCloseTo(valuate(cardIds, plan, ctx).net, 6)
    }
  })

  it('組み合わせの結果は、全額を1枚に寄せるどの割り当てよりも悪くない', () => {
    for (const { ctx, cardIds } of cases.slice(0, 60)) {
      const best = evaluateCardSet(cardIds, ctx)
      const fixed = fixedCosts(cardIds, ctx.assumptions)
      for (const id of cardIds) {
        const naive = valuate(
          cardIds,
          PAYEES.filter((p) => ctx.spend[p] > 0).map((p) => ({
            payee: p,
            // 銀行振込オンならオレンジコネックスは銀行振込（仕様どおり）
            cardId: p === 'oc' && ctx.ocBankActive ? ('ocBank' as const) : id,
            amount: ctx.spend[p],
            units: 0,
            value: 0,
          })),
          ctx,
        )
        // 上限のあるカードは全額を載せられないので比較対象から外す
        if (id === 'saison' || id === 'mercard') continue
        expect(best.net).toBeGreaterThanOrEqual(naive.net - 1)
        expect(fixed.fees).toBe(best.fees)
      }
    }
  })
})
