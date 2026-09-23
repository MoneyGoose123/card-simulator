import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { InputPanel } from './components/InputPanel'
import { Footer, Notes } from './components/Notes'
import { ResultPanel } from './components/ResultPanel'
import { BreakevenSection, GoalAnswers, PerkSection } from './components/Sections'
import { GOALS, RULES, VERIFIED_AT, type Goal } from './data/cards'
import { breakevens } from './lib/breakeven'
import { simulate, todayString, type SimInput, type SimResult } from './lib/simulate'
import { DEFAULT_STATE, parseState, spendYen, toQuery, type AppState } from './lib/urlState'

export default function App() {
  const [state, setState] = useState<AppState>(() => parseState(window.location.search))
  const [undo, setUndo] = useState<AppState | null>(null)
  const deferred = useDeferredValue(state)
  const today = todayString()
  const ocBankAvailable = today <= RULES.ocBank.endDate

  useEffect(() => {
    const url = `${window.location.pathname}?${toQuery(state)}`
    window.history.replaceState(null, '', url)
  }, [state])

  const input: SimInput = useMemo(
    () => ({ spend: spendYen(deferred.spendMan), goals: deferred.goals, entity: deferred.entity, assumptions: deferred.assumptions, today }),
    [deferred, today],
  )
  const result = useMemo(() => simulate(input), [input])
  const answers = useMemo(
    () => Object.fromEntries(GOALS.map((g) => [g, simulate({ ...input, goals: [g] })])) as Record<Goal, SimResult>,
    [input],
  )
  const rows = useMemo(() => breakevens(input.spend, input.assumptions, result.goals, input.entity), [input, result.goals])

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-10 sm:px-6">
      <header className="mb-6">
        <p className="text-xs font-semibold tracking-widest text-teal-700 dark:text-teal-400">MONEYGOOSE eBayスクール 会員向け</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">カード選びシミュレーター</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600 dark:text-stone-400">
          事業の支払い（送料・仕入れ）を、どのカードで払うと得か。月額または年額を入れると、年会費を引いた価値で組み合わせを比べます。
        </p>
        <p className="mt-1 text-xs text-stone-500">掲載情報の確認日：{VERIFIED_AT.replaceAll('-', '/')}</p>
        <nav className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-teal-800 dark:text-teal-300" aria-label="ページ内メニュー">
          <a href="#result" className="underline underline-offset-4">診断結果</a><a href="#answers" className="underline underline-offset-4">目的別に比較</a><a href="#notes" className="underline underline-offset-4">使う前に知っておくこと</a>
        </nav>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
          <button type="button" className="rounded-lg border border-stone-300 px-3 py-2 dark:border-stone-700" onClick={() => { setUndo(state); setState(DEFAULT_STATE) }}>入力をリセット</button>
          {undo && <button type="button" className="py-2 text-teal-800 underline dark:text-teal-300" onClick={() => { setState(undo); setUndo(null) }}>リセットを取り消す</button>}
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
        <InputPanel state={state} ocBankAvailable={ocBankAvailable} onChange={setState} />
        <div className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <ResultPanel result={result} state={deferred} />
        </div>
      </div>

      <div className="mt-5 space-y-5">
        <BreakevenSection rows={rows} />
        <PerkSection />
        <GoalAnswers answers={answers} active={result.goals} onSelect={goal => { setState({ ...state, goals: [goal] }); document.getElementById('result')?.scrollIntoView({ behavior: 'smooth' }) }} />
        <Notes ocBankActive={result.ocBankActive} />
      </div>

      <Footer assumptions={deferred.assumptions} />
    </div>
  )
}
