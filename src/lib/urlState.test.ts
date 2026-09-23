import { describe, expect, it } from 'vitest'
import { DEFAULT_STATE, parseState, toQuery } from './urlState'

describe('URLクエリ', () => {
  it('往復しても同じ状態に戻る', () => {
    const s = {
      ...DEFAULT_STATE,
      spendMan: { ...DEFAULT_STATE.spendMan, amazon: 200, other: 1.5 },
      goals: ['ana', 'hotel'] as const,
      entity: 'corp' as const,
      assumptions: { ...DEFAULT_STATE.assumptions, mileValue: 3, mercardRate: 0.02, ocBankTransfer: false, airLimit: 3_000_000, useOtherAirlines: false },
    }
    expect(parseState(toQuery({ ...s, goals: [...s.goals] }))).toEqual({ ...s, goals: [...s.goals] })
  })

  it('空のクエリは初期値', () => {
    expect(parseState('')).toEqual(DEFAULT_STATE)
  })

  it('不正な値は無視・範囲内に収める', () => {
    const s = parseState('?amazon=abc&other=-5&g=ana,foo,jal,hotel&mv=999')
    expect(s.spendMan.amazon).toBe(0)
    expect(s.spendMan.other).toBe(0)
    expect(s.goals).toEqual(['ana', 'jal'])
    expect(s.assumptions.mileValue).toBe(10)
  })

  it('目的を全部外した状態も保存できる', () => {
    expect(parseState(toQuery({ ...DEFAULT_STATE, goals: [] })).goals).toEqual([])
  })
})
