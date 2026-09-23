import { CARDS, GOALS, GOAL_LABELS, PERK_CARD_NOTES, totalFee, type CardId, type Goal } from '../data/cards'
import { fmtMan, type BreakevenRow } from '../lib/breakeven'
import { manYen, yen } from '../lib/format'
import type { SimResult } from '../lib/simulate'
import { comboName } from '../lib/labels'
import { Section } from './ui'

function BreakevenBar({ row }: { row: BreakevenRow }) {
  const t = row.threshold
  const max = Math.max(t ?? 0, row.userAmount, 1) * 1.25
  const reached = t !== null && row.userAmount >= t
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-sm font-semibold">{row.name}</p>
        <p className={`num text-sm font-bold ${t === null ? 'text-stone-500' : 'text-teal-800 dark:text-teal-300'}`}>{fmtMan(t)}</p>
      </div>
      <p className="text-xs text-stone-500 dark:text-stone-400">
        比べる相手：{row.compare}。{row.note}
      </p>
      <div className="relative mt-2 h-3 rounded-full bg-stone-100 dark:bg-stone-800" aria-hidden>
        <div
          className={`h-3 rounded-full ${reached ? 'bg-teal-600' : 'bg-stone-400 dark:bg-stone-600'}`}
          style={{ width: `${Math.min(100, (row.userAmount / max) * 100)}%` }}
        />
        {t !== null && (
          <div className="absolute -top-1 h-5 w-0.5 bg-rose-600" style={{ left: `${Math.min(100, (t / max) * 100)}%` }} title="分岐点" />
        )}
      </div>
      <p className="num mt-1 text-xs text-stone-600 dark:text-stone-300">
        あなたの{row.amountLabel}：{manYen(row.userAmount)}
        {t !== null && (reached ? ' → 元が取れる額です' : ` → あと${manYen(t - row.userAmount)}`)}
      </p>
    </li>
  )
}

export function BreakevenSection({ rows }: { rows: BreakevenRow[] }) {
  return (
    <Section
      id="breakeven"
      title="損益分岐点：いくら払うと元が取れる？"
      lead="年会費の高いカードは、支払いがこの額を超えてから作るのが目安です。赤い線が分岐点、棒があなたの支払い額です。"
    >
      <ul className="divide-y divide-stone-100 dark:divide-stone-800">
        {rows.map((r) => (
          <BreakevenBar key={r.id} row={r} />
        ))}
      </ul>
    </Section>
  )
}

const PERK_IDS: CardId[] = ['anaDiners', 'anaJcbWide', 'bizGold', 'upsider']

export function PerkSection() {
  return (
    <Section
      id="perk"
      title="利用枠・特典で選ぶカード"
      lead="還元率だけで見ると選ばれませんが、利用枠や特典を重視するなら候補になるカードです。計算では自動で選びません。"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {PERK_IDS.map((id) => {
          const c = CARDS[id]
          return (
            <article key={id} className="rounded-xl border border-stone-200 p-3 dark:border-stone-700">
              <h3 className="text-sm font-bold">{c.name}</h3>
              <p className="num mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                年会費 {totalFee(c) === 0 ? '無料' : yen(totalFee(c))}・{c.summary}
              </p>
              <p className="mt-2 text-sm leading-relaxed">{PERK_CARD_NOTES[id]}</p>
              <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">{c.conditions}</p>
            </article>
          )
        })}
      </div>
    </Section>
  )
}

export function GoalAnswers({ answers, active }: { answers: Record<Goal, SimResult>; active: Goal[] }) {
  return (
    <Section id="answers" title="目的別の答え" lead="今の支払い額で、目的を1つに絞った場合のおすすめです。">
      <ul className="divide-y divide-stone-100 dark:divide-stone-800">
        {GOALS.map((g) => {
          const r = answers[g]
          const has = r.best.allocations.length > 0
          return (
            <li key={g} className="grid gap-1 py-3 sm:grid-cols-[8rem_1fr_auto] sm:items-baseline sm:gap-3">
              <p className="text-sm font-semibold">
                {GOAL_LABELS[g]}
                {active.includes(g) && <span className="ml-1.5 rounded bg-teal-100 px-1.5 py-0.5 text-[10px] text-teal-800 dark:bg-teal-900 dark:text-teal-200">選択中</span>}
              </p>
              <p className="text-sm">{has ? comboName(r.best) : '—'}</p>
              <p className="num text-sm font-bold sm:text-right">{has ? yen(r.best.net) : ''}</p>
            </li>
          )
        })}
      </ul>
    </Section>
  )
}
