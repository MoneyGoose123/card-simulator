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
import { manYen } from '../lib/format'
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
        {(options.includes(value) ? options : [value, ...options]).map((o) => (
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
  const factor = state.inputPeriod === 'month' ? 12 : 1
  const annualTotal = Object.values(state.spendMan).reduce((sum, n) => sum + n, 0) * 10_000
  const a = state.assumptions
  const setA = (patch: Partial<Assumptions>) => onChange({ ...state, assumptions: { ...a, ...patch } })

  const onGoal = (g: Goal) => {
    const res = toggleGoal(state.goals, g)
    setGoalError(res.error)
    onChange({ ...state, goals: res.goals })
  }

  return (
    <div className="space-y-5">
      <Section title={state.inputPeriod === 'month' ? '月平均の支払い額' : '年間の支払い額'} lead="事業の支払いだけを入れてください（生活費は含めません）。">
        <div className="mb-3 flex gap-2" aria-label="入力する期間">
          <Chip active={state.inputPeriod === 'year'} onClick={() => onChange({ ...state, inputPeriod: 'year' })}>年額で入力</Chip>
          <Chip active={state.inputPeriod === 'month'} onClick={() => onChange({ ...state, inputPeriod: 'month' })}>月額で入力</Chip>
        </div>
        <p className="mb-2 text-xs text-stone-500">切り替えても年間の合計は変わりません。月額は12か月分に換算します。</p>
        <div className="divide-y divide-stone-200 dark:divide-stone-800">
          {PAYEES.map((p) => (
            <SpendInput
              key={p}
              payee={p}
              value={Number((state.spendMan[p] / factor).toFixed(6))}
              onChange={(v) => onChange({ ...state, spendMan: { ...state.spendMan, [p]: Math.min(1_000_000, v * factor) } })}
            />
          ))}
        </div>
        <div className="mt-3 rounded-xl bg-stone-100 p-3 dark:bg-stone-800">
          <p className="text-sm font-semibold">年間合計 <span className="num">{manYen(annualTotal)}</span></p>
          <p className="num mt-1 text-xs text-stone-500">月平均 {manYen(annualTotal / 12)}</p>
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

      <Section title="カードは何枚まで？" lead="管理のしやすさも含めて比較できます。銀行振込は枚数に含めません。">
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 0].map((n) => <Chip key={n} active={a.maxCards === n} onClick={() => setA({ maxCards: n })}>{n === 0 ? '制限なし' : `${n}枚まで`}</Chip>)}
        </div>
      </Section>

      <details className="group rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900/60">
        <summary className="cursor-pointer text-sm font-semibold select-none">計算の前提を変える</summary>
        <div className="mt-3 divide-y divide-stone-100 dark:divide-stone-800">
          <Select label="1マイルの価値" value={a.mileValue} options={ASSUMPTION_OPTIONS.mileValue} format={(v) => `${v}円`} onChange={(v) => setA({ mileValue: v })} />
          <Select label="マリオット1ポイントの価値（ホテルで使う場合）" value={a.marriottPointValue} options={ASSUMPTION_OPTIONS.marriottPointValue} format={(v) => `${v}円`} onChange={(v) => setA({ marriottPointValue: v })} />
          <Select label="メルカリで仕入れる月数（年間）" value={a.mercariMonths} options={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]} format={(v) => `${v}か月`} onChange={(v) => setA({ mercariMonths: v })} />
          <p className="py-2 text-xs text-stone-500">メルカリの年間額を、この月数に均等に分けて上限を計算します。繁忙月への集中は反映しません。</p>
          <Select label="メルカードの還元率（メルカリ）" value={a.mercardRate} options={ASSUMPTION_OPTIONS.mercardRate} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setA({ mercardRate: v })} />
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
                onChange={(e) => setA({ freeNightValue: Math.min(100, Math.max(0, Number(e.target.value) || 0)) * 10_000 })}
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
          <label className="flex items-start gap-3 py-2.5 text-sm">
            <input type="checkbox" className="mt-0.5 size-4 accent-teal-700" checked={a.useOtherAirlines} onChange={(e) => setA({ useOtherAirlines: e.target.checked })} />
            <span>
              アメックスでANAに移せない分（年4万マイル超）を、ANA以外の航空会社のマイルとして使う
              <span className="block text-xs text-stone-500 dark:text-stone-400">オフにすると、超えた分の価値を0円で計算します。</span>
            </span>
          </label>
          <label className="flex items-start gap-3 py-2.5 text-sm">
            <input type="checkbox" className="mt-0.5 size-4 accent-teal-700" checked={a.allowInviteOnly} onChange={(e) => setA({ allowInviteOnly: e.target.checked })} />
            <span>ANAダイナース プレミアムの招待を受けている<span className="block text-xs text-stone-500">オンにすると招待制カードも比較に含めます。</span></span>
          </label>
          <Select label="Airカードの利用枠（総枠）" value={a.airLimit} options={ASSUMPTION_OPTIONS.airLimit} format={(v) => `${v / 10_000}万円`} onChange={(v) => setA({ airLimit: v })} />
        </div>
      </details>
    </div>
  )
}
