import { describe, expect, it } from 'vitest'
import { DEFAULT_ASSUMPTIONS, PAYEES, type Payee } from '../data/cards'
import { breakevens, fmtMan } from './breakeven'

const zero = Object.fromEntries(PAYEES.map((p) => [p, 0])) as Record<Payee, number>
const at = (V: number, goals: ('ana' | 'hotel')[] = ['ana']) =>
  Object.fromEntries(breakevens(zero, { ...DEFAULT_ASSUMPTIONS, mileValue: V }, goals).map((r) => [r.id, r]))

describe('5-6 損益分岐点（2円のとき）', () => {
  const rows = at(2)
  // ANA移行の年間参加費5,500円を含めて22,000円 ÷ (0.03×2 − 0.015)
  it('ビジネス・グリーン 約49万円', () => expect(Math.round(rows.bizGreen.threshold!)).toBe(488_889))
  it('ANA JCB 約9万円（継続マイル込み）、込まない場合 約50万円', () => {
    expect(Math.round(rows.anaJcb.threshold!)).toBe(95_000)
    expect(rows.anaJcb.note).toContain('約50万円')
  })
  it('セゾン 440万円', () => expect(Math.round(rows.saison.threshold!)).toBe(4_400_000))
  it('プレミアム 約1,720万円', () => expect(Math.round(rows.anaDinersPremium.threshold!)).toBe(17_202_500))
  it('マリオット 400万円（ホテル・マイルとも）', () => {
    expect(rows.marriott.threshold).toBe(4_000_000)
    expect(at(2, ['hotel']).marriott.threshold).toBe(4_000_000)
  })
})

describe('分母が0以下なら元が取れない', () => {
  it('1.5円のとき ANA JCBはAirカードと同率で元が取れない', () => {
    expect(at(1.5).anaJcb.threshold).toBeNull()
    expect(fmtMan(null)).toBe('この前提では元が取れません')
  })
})
