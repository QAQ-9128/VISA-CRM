import type { ReactNode } from 'react'
import type { MonthOverMonth } from '../../lib/dashboard'
import { Well } from '../ui/Well'
import type { WellTone } from '../ui/Well'
import { TrendDownIcon, TrendUpIcon } from '../ui/icons'

const TREND_CLS: Record<MonthOverMonth['dir'], string> = {
  up: 'bg-emerald-50 text-emerald-600',
  down: 'bg-rose-50 text-rose-600',
  flat: 'bg-surface-2 text-muted',
}

/**
 * 概览统计卡（Layout A）：图标井 + 大数字 + 标签，右上可选月环比胶囊。
 * 趋势仅在 trend 提供时显示（0 值/无历史由调用方决定不传）。
 */
export function StatCard({
  icon,
  tone = 'brand',
  value,
  label,
  trend,
}: {
  icon: ReactNode
  tone?: WellTone
  value: ReactNode
  label: string
  trend?: MonthOverMonth
}) {
  return (
    <div className="rounded-card bg-white p-[22px] shadow-soft">
      <div className="flex items-center justify-between">
        <Well tone={tone}>{icon}</Well>
        {trend && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-[9px] py-1 text-xs font-bold ${TREND_CLS[trend.dir]}`}
          >
            {trend.dir === 'up' ? (
              <TrendUpIcon className="size-[13px]" />
            ) : trend.dir === 'down' ? (
              <TrendDownIcon className="size-[13px]" />
            ) : null}
            {trend.pct == null ? '新增' : `${trend.pct}%`}
          </span>
        )}
      </div>
      <div className="mt-[18px] mb-1 text-[32px] font-bold tracking-[-0.02em] tabular-nums text-ink">
        {value}
      </div>
      <div className="text-[13px] text-muted">{label}</div>
    </div>
  )
}
