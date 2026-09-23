// 入力値 ⇔ URLクエリ。共有用なので短いキーにする。
import { DEFAULT_ASSUMPTIONS, GOALS, MAX_GOALS, PAYEES, type Assumptions, type Goal, type Payee } from '../data/cards'
import type { Entity } from './simulate'

export interface AppState {
  /** 万円 */
  spendMan: Record<Payee, number>
  inputPeriod: 'year' | 'month'
  goals: Goal[]
  entity: Entity
  assumptions: Assumptions
}

export const DEFAULT_STATE: AppState = {
  spendMan: Object.fromEntries(PAYEES.map((p) => [p, 0])) as Record<Payee, number>,
  inputPeriod: 'year',
  goals: ['cash'],
  entity: 'sole',
  assumptions: DEFAULT_ASSUMPTIONS,
}

const num = (v: string | null, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  if (v === null || v.trim() === '') return fallback
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

export function parseState(search: string): AppState {
  const q = new URLSearchParams(search)
  const d = DEFAULT_STATE
  const spendMan = Object.fromEntries(PAYEES.map((p) => [p, num(q.get(p), 0, 0, 1_000_000)])) as Record<Payee, number>
  const goals = q.has('g')
    ? [...new Set((q.get('g') ?? '').split(',').filter((g): g is Goal => (GOALS as readonly string[]).includes(g)))].slice(0, MAX_GOALS)
    : d.goals
  const a = d.assumptions
  return {
    spendMan,
    inputPeriod: q.get('u') === 'm' ? 'month' : 'year',
    goals,
    entity: q.get('e') === 'corp' ? 'corp' : 'sole',
    assumptions: {
      maxCards: Math.round(num(q.get('mc'), a.maxCards, 0, 3)),
      allowInviteOnly: q.get('iv') === '1',
      mercariMonths: Math.round(num(q.get('mm'), a.mercariMonths, 1, 12)),
      mileValue: num(q.get('mv'), a.mileValue, 0.1, 10),
      marriottPointValue: num(q.get('pv'), a.marriottPointValue, 0.1, 5),
      mercardRate: num(q.get('mr'), a.mercardRate * 100, 0, 10) / 100,
      freeNightValue: num(q.get('fn'), a.freeNightValue / 10_000, 0, 100) * 10_000,
      ocBankTransfer: q.has('ob') ? q.get('ob') === '1' : a.ocBankTransfer,
      airLimit: num(q.get('al'), a.airLimit / 10_000, 1, 10_000) * 10_000,
      useOtherAirlines: q.has('oa') ? q.get('oa') === '1' : a.useOtherAirlines,
    },
  }
}

export function toQuery(s: AppState): string {
  const q = new URLSearchParams()
  for (const p of PAYEES) if (s.spendMan[p] > 0) q.set(p, String(s.spendMan[p]))
  if (s.inputPeriod === 'month') q.set('u', 'm')
  q.set('g', s.goals.join(','))
  if (s.entity === 'corp') q.set('e', 'corp')
  const a = s.assumptions
  const d = DEFAULT_STATE.assumptions
  if (a.maxCards !== d.maxCards) q.set('mc', String(a.maxCards))
  if (a.allowInviteOnly) q.set('iv', '1')
  if (a.mercariMonths !== d.mercariMonths) q.set('mm', String(a.mercariMonths))
  if (a.mileValue !== d.mileValue) q.set('mv', String(a.mileValue))
  if (a.marriottPointValue !== d.marriottPointValue) q.set('pv', String(a.marriottPointValue))
  if (a.mercardRate !== d.mercardRate) q.set('mr', String(a.mercardRate * 100))
  if (a.freeNightValue !== d.freeNightValue) q.set('fn', String(a.freeNightValue / 10_000))
  if (a.ocBankTransfer !== d.ocBankTransfer) q.set('ob', a.ocBankTransfer ? '1' : '0')
  if (a.airLimit !== d.airLimit) q.set('al', String(a.airLimit / 10_000))
  if (a.useOtherAirlines !== d.useOtherAirlines) q.set('oa', a.useOtherAirlines ? '1' : '0')
  return q.toString()
}

export function spendYen(spendMan: Record<Payee, number>): Record<Payee, number> {
  return Object.fromEntries(PAYEES.map((p) => [p, Math.round(spendMan[p] * 10_000)])) as Record<Payee, number>
}
