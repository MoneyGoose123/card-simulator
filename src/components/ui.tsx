import type { ReactNode } from 'react'

export function Section({ title, lead, children, id }: { title: string; lead?: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 dark:border-stone-800 dark:bg-stone-900/60">
      <h2 className="text-base font-bold">{title}</h2>
      {lead && <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">{lead}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

export function Callout({ tone = 'warn', children }: { tone?: 'warn' | 'info'; children: ReactNode }) {
  const cls =
    tone === 'warn'
      ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100'
      : 'border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-100'
  return <div className={`rounded-lg border px-3 py-2 text-sm leading-relaxed ${cls}`}>{children}</div>
}
