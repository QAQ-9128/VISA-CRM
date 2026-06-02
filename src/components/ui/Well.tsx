import type { ReactNode } from 'react'

/** 图标井：圆角方块、浅色底 + 同色图标。用于统计卡与「即将到期」行。 */
const TONE: Record<string, string> = {
  brand: 'bg-brand-50 text-brand',
  emerald: 'bg-emerald-50 text-emerald-600',
  rose: 'bg-rose-50 text-rose-600',
  amber: 'bg-amber-50 text-amber-600',
  sky: 'bg-sky-50 text-sky-600',
  violet: 'bg-violet-50 text-violet-600',
  indigo: 'bg-brand-50 text-brand',
}

export type WellTone = keyof typeof TONE

export function Well({
  children,
  tone = 'brand',
  size = 50,
}: {
  children: ReactNode
  tone?: WellTone
  size?: number
}) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-[16px] ${TONE[tone] ?? TONE.brand}`}
      style={{ width: size, height: size }}
    >
      {children}
    </span>
  )
}
