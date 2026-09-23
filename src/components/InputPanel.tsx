import { useState } from 'react'
import {
  ASSUMPTION_OPTIONS,
  GOALS,
  GOAL_LABELS,
  PAYEES,
  PAYEE_LABELS,
  RULES,
  type Assumptions,
  type Goal,
  type Payee,
} from '../data/cards'
import { toggleGoal, type Entity } from '../lib/simulate'
import type { AppState } from '../lib/urlState'
import { Section } from './ui'

interface Props {
  state: AppState
  ocBankAvailable: boolean
  onChange: (next: AppState) => void
}

const inputCls =
  'num w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-right text-base outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-stone-700 dark:bg-stone-900'

function SpendInput({ payee, value, onChange }: { payee: Payee; value: number; onChange: (v: number) => void }) {
  const { name, note } = PAYEE_LABELS[payee]
  return (
    <label className="grid grid-cols-[1fr_8.5rem] items-center gap-3 py-2">
      <span>
        <span className="block text-sm font-medium">{name}</span>
        {note && <span className="block text-xs text-stone-500 dark:text-stone-400">{note}</span>}
      </span>
      <span className="relative">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          className={`${inputCls} pr-12`}
          value={value === 0 ? '' : value}
          placeholder="0"
          onChange={(e) => {
            const n = Number(e.target.value)
            onChange(Number.isFinite(n) && n > 0 ? n : 0)
          }}
        />
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-stone-500">万円</span>
      </span>
    </label>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
        active
          ? 'border-teal-700 bg-teal-700 text-white dark:border-teal-500 dark:bg-teal-600'
          : 'border-stone-300 bg-white text-stone-700 hover:border-teal-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200'
      }`}
    >
      {children}
    </button>
  )
}

function Select<T extends number>({ label, value, options, format, onChange }: {
  label: string
  value: T
  options: readonly T[]
  format: (v: T) => string
  onChange: (v: T) => void
}) {
  return (
    <label className="grid grid-cols-[1fr_8.5rem] items-center gap-3 py-1.5 text-sm">
      <span>{label}</span>
      <select className={inputCls} value={value} onChange={(e) => onChange(Number(e.target.value) as T)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {format(o)}
          </option>
        ))}
      </select>
    </label>
  )
}

export function InputPanel({ state, ocBankAvailable, onChange }: Props) {
  const [goalError, setGoalError] = useState<string>()
  const a = state.assumptions
  const setA = (patch: Partial<Assumptions>) => onChange({ ...state, assumptions: { ...a, ...patch } })

  const onGoal = (g: Goal) => {
    const res = toggleGoal(state.goals, g)
    setGoalError(res.error)
    onChange({ ...state, goals: res.goals })
  }

  return (
    <div className="space-y-5">
      <Section title="年間の支払い額" lead="事業の支払いだけを入れてください（生活費は含めません）。">
        <div className="divide-y divide-stone-200 dark:divide-stone-800">
          {PAYEES.map((p) => (
            <SpendInput
              key={p}
              payee={p}
              value={state.spendMan[p]}
              onChange={(v) => onChange({ ...state, spendMan: { ...state.spendMan, [p]: v } })}
            />
          ))}
        </div>
      </Section>

      <Section title="事業の形態">
        <div className="flex gap-2">
          {(['sole', 'corp'] as Entity[]).map((e) => (
            <Chip key={e} active={state.entity === e} onClick={() => onChange({ ...state, entity: e })}>
              {e === 'sole' ? '個人事業主' : '法人'}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="何を貯めたい？" lead="2つまで選べます。選ばないときは現金ポイントで計算します。">
        <div className="flex flex-wrap gap-2">
          {GOALS.map((g) => (
            <Chip key={g} active={state.goals.includes(g)} onClick={() => onGoal(g)}>
              {GOAL_LABELS[g]}
            </Chip>
          ))}
        </div>
        {goalError && (
          <p role="alert" className="mt-2 text-sm font-medium text-amber-700 dark:text-amber-400">
            {goalError}
          </p>
        )}
      </Section>

      <details className="group rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900/60">
        <summary className="cursor-pointer text-sm font-semibold select-none">計算の前提を変える</summary>
        <div className="mt-3 divide-y divide-stone-100 dark:divide-stone-800">
          <Select label="1マイルの価値" value={a.mileValue} options={ASSUMPTION_OPTIONS.mileValue} format={(v) => `${v}円`} onChange={(v) => setA({ mileValue: v })} />
          <Select label="マリオット1ポイントの価値（ホテルで使う場合）" value={a.marriottPointValue} options={ASSUMPTION_OPTIONS.marriottPointValue} format={(v) => `${v}円`} onChange={(v) => setA({ marriottPointValue: v })} />
          <Select label="メルカードの還元率" value={a.mercardRate} options={ASSUMPTION_OPTIONS.mercardRate} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setA({ mercardRate: v })} />
          <label className="grid grid-cols-[1fr_8.5rem] items-center gap-3 py-1.5 text-sm">
            <span>マリオット無料宿泊1泊の価値</span>
            <span className="relative">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                className={`${inputCls} pr-12`}
                value={a.freeNightValue / 10_000}
                onChange={(e) => setA({ freeNightValue: Math.max(0, Number(e.target.value) || 0) * 10_000 })}
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-stone-500">万円</span>
            </span>
          </label>
          {ocBankAvailable && (
            <label className="flex items-start gap-3 py-2.5 text-sm">
              <input type="checkbox" className="mt-0.5 size-4 accent-teal-700" checked={a.ocBankTransfer} onChange={(e) => setA({ ocBankTransfer: e.target.checked })} />
              <span>
                オレンジコネックスを銀行振込で払う（{RULES.ocBank.rate * 100}%還元）
                <span className="block text-xs text-stone-500 dark:text-stone-400">{RULES.ocBank.endDate.replaceAll('-', '/')}まで。前払いになります。</span>
              </span>
            </label>
          )}
          <Select label="Airカードの利用枠（月）" value={a.airLimit} options={ASSUMPTION_OPTIONS.airLimit} format={(v) => `${v / 10_000}万円`} onChange={(v) => setA({ airLimit: v })} />
        </div>
      </details>
    </div>
  )
}
