import { CARDS } from '../data/cards'
import type { AllocTarget } from './allocate'
import type { ComboResult } from './simulate'

export const targetName = (id: AllocTarget) =>
  id === 'ocBank' ? '銀行振込（2.1%還元）' : id === 'none' ? '還元なし（カードを使わない）' : CARDS[id].name

export function comboName(r: ComboResult): string {
  return r.cardIds.length ? r.cardIds.map((id) => CARDS[id].name).join(' ＋ ') : 'カードを作らない（今の支払い額では年会費の元が取れません）'
}
