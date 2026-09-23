import { CARDS, GOAL_LABELS, PAYEE_LABELS, totalFee } from '../data/cards'
import { count, manYen, signedYen, yen } from '../lib/format'
import { comboName, targetName } from '../lib/labels'
import type { SimResult } from '../lib/simulate'
import type { AppState } from '../lib/urlState'
import { ShareActions } from './ShareActions'
import { Callout } from './ui'

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1 text-sm ${muted ? 'text-stone-500 dark:text-stone-400' : ''}`}>
      <span>{label}</span>
      <span className={`num ${strong ? 'text-base font-bold' : ''}`}>{value}</span>
    </div>
  )
}

export function ResultPanel({ result, state }: { result: SimResult; state: AppState }) {
  const { best, allAir, cashTrio } = result
  const diff = best.net - allAir.net
  const firstYearFree = best.cardIds.flatMap((id) => CARDS[id].fees.filter((f) => f.firstYearFree).map((f) => ({ card: CARDS[id].name, fee: f })))
  // 入力の有無は割り当て結果ではなく入力額の合計で判定する
  const hasSpend = best.allocations.reduce((sum, al) => sum + al.amount, 0) > 0

  return (
    <div id="result" className="scroll-mt-4 rounded-2xl border border-teal-700/30 bg-white p-4 shadow-sm sm:p-5 dark:border-teal-500/30 dark:bg-stone-900">
      <p className="text-xs font-semibold tracking-wide text-teal-700 dark:text-teal-400">
        あなたにおすすめの組み合わせ（{result.goals.map((g) => GOAL_LABELS[g]).join('＋')}）
      </p>
      <h2 className="mt-1 text-lg leading-snug font-bold">{hasSpend ? comboName(best) : '支払い額を入れると結果が出ます'}</h2>

      {hasSpend && (
        <>
          <p className="mt-2 text-xs leading-relaxed text-stone-500">掲載候補から、選択した目的・条件で比較した結果です。{best.cardIds.length}枚使用 / 1マイル＝{state.assumptions.mileValue}円 / 2年目以降の年会費で計算</p>
          <div className="mt-4 grid gap-3 min-[380px]:grid-cols-2">
            <div className="rounded-xl bg-teal-50 p-3 dark:bg-teal-950/50">
              <p className="text-xs text-teal-900 dark:text-teal-200">年会費を引いた価値（年間）</p>
              <p className="num mt-1 text-2xl font-bold text-teal-800 dark:text-teal-300">{yen(best.net)}<span className="ml-1 text-xs">相当</span></p>
            </div>
            <div className="rounded-xl bg-stone-100 p-3 dark:bg-stone-800">
              <p className="text-xs text-stone-600 dark:text-stone-300">全部Airカードとの差</p>
              <p className={`num mt-1 text-2xl font-bold ${diff >= 0 ? 'text-stone-900 dark:text-stone-50' : 'text-rose-700'}`}>{signedYen(diff)}<span className="ml-1 text-xs">相当</span></p>
            </div>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-stone-500">マイル・宿泊を設定した価値で使い切る前提の試算です。現金で受け取れる額とは異なります。</p>
          <div className="mt-4 space-y-2">
            <h3 className="text-sm font-bold">カード別の支払い目安</h3>
            {best.cardIds.map(id => {
              const amount = best.allocations.filter(al => al.cardId === id).reduce((sum, al) => sum + al.amount, 0)
              const c = CARDS[id]
              return <article key={id} className="rounded-xl border border-stone-200 p-3 dark:border-stone-700">
                <div className="flex flex-wrap items-baseline justify-between gap-2"><h4 className="text-sm font-semibold">{c.name}</h4><a className="text-xs text-teal-800 underline underline-offset-2 dark:text-teal-300" href={c.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={`${c.name}の公式条件を確認`}>公式条件 ↗</a></div>
                <p className="num mt-1 text-sm font-bold">年間 {manYen(amount)} <span className="text-xs font-normal text-stone-500">/ 月平均 {manYen(amount / 12)}</span></p>
                <p className="mt-1 text-xs text-stone-500">年間費用 {yen(totalFee(c))}（移行費等込み）</p>
                <p className="mt-1 text-xs leading-relaxed text-stone-500">{c.conditions}</p>
              </article>
            })}
          </div>
          <h3 className="mt-5 text-sm font-bold">支払い先ごとの配分</h3>
          <p className="mt-1 text-xs text-stone-500">同じ支払い先を分ける場合は、購入ごとにカードを使い分ける想定です。月平均は目安で、実際の利用枠・繁忙月は別途確認してください。</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-xs text-stone-500 dark:border-stone-700 dark:text-stone-400">
                  <th className="w-[32%] py-1.5 font-medium">支払い先</th>
                  <th className="py-1.5 font-medium">カード</th>
                  <th className="w-[26%] py-1.5 text-right font-medium">年間の価値</th>
                </tr>
              </thead>
              <tbody>
                {best.allocations.map((al, i) => (
                  <tr key={`${al.payee}-${al.cardId}-${i}`} className="border-b border-stone-100 align-top dark:border-stone-800">
                    <td className="py-2 pr-2">
                      {PAYEE_LABELS[al.payee].name}
                      <span className="num block text-xs text-stone-500">{manYen(al.amount)}</span>
                    </td>
                    <td className="py-2 pr-2">{targetName(al.cardId)}</td>
                    <td className="num py-2 text-right break-words">{yen(al.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 border-t border-stone-200 pt-2 dark:border-stone-700">
            <Row label="ポイント・マイルの価値" value={yen(best.gross)} />
            {best.bonus > 0 && <Row label="継続ボーナスマイル" value={`+${yen(best.bonus)}`} />}
            {best.freeNight > 0 && <Row label="マリオット無料宿泊" value={`+${yen(best.freeNight)}`} />}
            <Row label="年会費（2年目以降）" value={`−${yen(best.fees)}`} />
            <Row label="年会費を引いた合計" value={yen(best.net)} strong />
            {firstYearFree.map(({ card, fee }) => (
              <p key={card} className="text-xs text-teal-800 dark:text-teal-300">
                {card}は初年度は{fee.label}（{yen(fee.amount)}）が無料です。
              </p>
            ))}
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold text-stone-500 dark:text-stone-400">貯まるもの（年間）</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {best.breakdown.map((b) => (
                <div key={b.key} className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm dark:border-stone-700">
                  <span className="text-stone-600 dark:text-stone-300">{b.label}</span>{' '}
                  <span className="num font-bold">{count(b.amount)}</span>
                  <span className="text-xs">{b.unit}</span>
                  {b.note && <span className="block text-xs text-stone-500">{b.note}</span>}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-stone-50 p-3 dark:bg-stone-800/60">
            <p className="text-xs font-semibold text-stone-500 dark:text-stone-400">比べると</p>
            <Row label="全部Airカード" value={yen(allAir.net)} muted />
            <Row label={`現金派（${cashTrio.cardIds.map((id) => CARDS[id].name).join('＋') || 'カードなし'}）`} value={yen(cashTrio.net)} muted />
          </div>

          {(result.skippedGoals.length > 0 || result.warnings.length > 0) && (
            <div className="mt-4 space-y-2">
              {result.skippedGoals.map((s) => (
                <Callout key={s.goal} tone="info">
                  {s.reason}
                </Callout>
              ))}
              {result.warnings.map((w) => (
                <Callout key={w.id}>{w.message}</Callout>
              ))}
            </div>
          )}

          <p className="mt-4 text-xs text-stone-500 dark:text-stone-400">申し込み前に中村へご相談ください。</p>
          <ShareActions state={state} result={result} />
        </>
      )}
    </div>
  )
}
