import { describe, expect, it } from 'vitest'
import { DEFAULT_ASSUMPTIONS, PAYEES, type CardId, type Goal, type Payee } from '../data/cards'
import { allocateAmounts, fixedCosts, quickNet, valuate, type Assignment, type Context } from './allocate'

// 疑似乱数（再現性のため固定シード）
function rng(seed: number) {
  return () => ((seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31)
}

describe('探索用の高速版と詳細版の一致', () => {
  it('ランダムな割り当て500件で net が一致する', () => {
    const rand = rng(42)
    const cards: CardId[] = ['air', 'mercard', 'bizOne', 'anaJcb', 'anaDinersPremium', 'bizGreen', 'saison', 'marriott']
    const goalSets: Goal[][] = [['ana'], ['jal'], ['hotel'], ['cash'], ['ana', 'hotel'], ['ana', 'jal']]
    for (let n = 0; n < 500; n++) {
      const spend = Object.fromEntries(PAYEES.map((p) => [p, rand() < 0.3 ? 0 : Math.round(rand() * 1000) * 10_000])) as Record<Payee, number>
      const ctx: Context = {
        spend,
        goals: goalSets[n % goalSets.length],
        assumptions: { ...DEFAULT_ASSUMPTIONS, mileValue: [1.5, 2, 3][n % 3] },
        ocBankActive: n % 2 === 0,
      }
      const cardIds = cards.filter(() => rand() < 0.5)
      if (cardIds.length === 0) continue
      const assignment: Assignment = Object.fromEntries(PAYEES.map((p) => [p, cardIds[Math.floor(rand() * cardIds.length)]]))
      const allocs = allocateAmounts(cardIds, assignment, ctx)
      expect(quickNet(allocs, ctx, fixedCosts(cardIds, ctx.assumptions))).toBeCloseTo(valuate(cardIds, allocs, ctx).net, 6)
    }
  })
})
