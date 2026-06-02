import { currentMonth, shiftMonth, monthLabel } from '../../lib/month'

/**
 * 月份选择器：← / → 切换月份 + 原生 month 选择 + 「全部」开关。
 * value = 'YYYY-MM' 选定月份；null = 全部（不按月筛选）。
 */
export function MonthSelector({
  value,
  onChange,
}: {
  value: string | null
  onChange: (month: string | null) => void
}) {
  const isAll = value === null
  const ym = value ?? currentMonth()

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        aria-label="上个月"
        disabled={isAll}
        onClick={() => onChange(shiftMonth(ym, -1))}
        className="flex size-9 items-center justify-center rounded-xl border border-line-2 bg-white text-muted hover:bg-surface-2 disabled:opacity-40"
      >
        ‹
      </button>

      <label
        className={`inline-flex h-9 items-center gap-1.5 rounded-xl border border-line-2 bg-white px-3 text-sm font-semibold focus-within:border-brand focus-within:ring-2 focus-within:ring-brand-100 ${
          isAll ? 'text-faint' : 'text-ink'
        }`}
      >
        <span aria-hidden>📅</span>
        <input
          type="month"
          value={ym}
          onChange={(e) => onChange(e.target.value || null)}
          className="bg-transparent text-sm outline-none [color-scheme:light]"
        />
      </label>

      <button
        type="button"
        aria-label="下个月"
        disabled={isAll}
        onClick={() => onChange(shiftMonth(ym, 1))}
        className="flex size-9 items-center justify-center rounded-xl border border-line-2 bg-white text-muted hover:bg-surface-2 disabled:opacity-40"
      >
        ›
      </button>

      <button
        type="button"
        onClick={() => onChange(isAll ? currentMonth() : null)}
        className={`h-9 rounded-xl border px-4 text-sm font-semibold transition-colors ${
          isAll
            ? 'border-brand bg-brand text-white shadow-xs'
            : 'border-line-2 bg-white text-body hover:bg-surface-2'
        }`}
      >
        全部
      </button>

      <span className="text-sm text-faint">{isAll ? '所有时间' : monthLabel(ym)}</span>
    </div>
  )
}
