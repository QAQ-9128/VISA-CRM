import type { ReactNode } from 'react'

/** 语义色胶囊。底/字用对齐设计令牌的浅底+深字；dot 用 currentColor。 */
const TONE: Record<string, string> = {
  slate: 'bg-slate-100 text-slate-600',
  blue: 'bg-blue-50 text-blue-700',
  indigo: 'bg-brand-50 text-brand',
  cyan: 'bg-cyan-50 text-cyan-700',
  teal: 'bg-teal-50 text-teal-700',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-700',
  rose: 'bg-rose-50 text-rose-600',
  violet: 'bg-violet-50 text-violet-700',
  sky: 'bg-sky-50 text-sky-700',
}

export type PillTone = keyof typeof TONE

export function Pill({
  tone = 'slate',
  dot = true,
  children,
}: {
  tone?: PillTone
  dot?: boolean
  children: ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-[11px] py-1 text-xs font-semibold ${
        TONE[tone] ?? TONE.slate
      }`}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}
