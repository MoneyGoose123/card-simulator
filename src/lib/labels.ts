import { CARDS } from '../data/cards'
import type { AllocTarget } from './allocate'
import type { ComboResult } from './simulate'

export const targetName = (id: AllocTarget) => (id === 'ocBank' ? '銀行振込（2.1%還元）' : CARDS[id].name)

export function comboName(r: ComboResult): string {
  return r.cardIds.length ? r.cardIds.map((id) => CARDS[id].name).join(' ＋ ') : 'カードを作らない（年会費のかかるカードは元が取れません）'
}
