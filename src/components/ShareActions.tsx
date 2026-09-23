import { useState } from 'react'
import { GOAL_LABELS, PAYEE_LABELS } from '../data/cards'
import { yen } from '../lib/format'
import { comboName, targetName } from '../lib/labels'
import type { SimResult } from '../lib/simulate'
import { toQuery, type AppState } from '../lib/urlState'

export function ShareActions({ state, result }: { state: AppState; result: SimResult }) {
  const [message, setMessage] = useState('')
  const [fallback, setFallback] = useState('')
  async function copy(kind: 'url' | 'summary') {
    const url = `${window.location.origin}${window.location.pathname}?${toQuery(state)}`
    const a = state.assumptions
    const value = kind === 'url' ? url : [
      'カード選びの相談（MoneyGoose）',
      `${state.entity === 'sole' ? '個人事業主' : '法人'} / ${result.goals.map(g => GOAL_LABELS[g]).join('＋')}`,
      `候補：${comboName(result.best)}`,
      `年会費を引いた年間価値：${yen(result.best.net)}相当（2年目以降）`,
      ...result.best.allocations.map(al => `${PAYEE_LABELS[al.payee].name}：${targetName(al.cardId)} / 年${yen(al.amount)}`),
      `前提：1マイル${a.mileValue}円、ホテル1pt ${a.marriottPointValue}円、無料宿泊${yen(a.freeNightValue)}、メルカード${a.mercardRate * 100}% / 年${a.mercariMonths}か月`,
      ...result.warnings.map(w => `注意：${w.message}`),
      `条件と詳細：${url}`,
    ].join('\n')
    try {
      await navigator.clipboard.writeText(value)
      setFallback('')
      setMessage(kind === 'url' ? '条件のURLをコピーしました。' : '相談用の結果をコピーしました。')
    } catch {
      setFallback(value)
      setMessage('自動コピーが使えません。下の欄を選択してコピーしてください。')
    }
  }
  return <div className="mt-4 border-t border-stone-200 pt-4 dark:border-stone-700">
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => void copy('summary')} className="rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-800">相談用に結果をコピー</button>
      <button type="button" onClick={() => void copy('url')} className="rounded-xl border border-stone-300 px-4 py-3 text-sm font-medium dark:border-stone-600">条件のURLをコピー</button>
    </div>
    <p className="mt-2 text-xs text-stone-500">共有するURLには、入力した金額と条件が含まれます。</p>
    <p role="status" className="mt-1 text-xs text-teal-800 dark:text-teal-300">{message}</p>
    {fallback && <textarea aria-label="コピーする内容" readOnly value={fallback} onFocus={e => e.currentTarget.select()} rows={5} className="mt-2 w-full rounded-lg border border-stone-300 p-2 text-xs dark:bg-stone-900" />}
  </div>
}
