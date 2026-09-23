export const yen = (n: number) => `${Math.round(n).toLocaleString('ja-JP')}円`
export const signedYen = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(Math.round(n)).toLocaleString('ja-JP')}円`
export const count = (n: number) => Math.round(n).toLocaleString('ja-JP')
export const manYen = (n: number) => `${(Math.round(n / 1_000) / 10).toLocaleString('ja-JP')}万円`
