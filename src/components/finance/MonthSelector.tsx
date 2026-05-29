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
        className="flex size-9 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
      >
        ‹
      </button>

      <input
        type="month"
        value={ym}
        onChange={(e) => onChange(e.target.value || null)}
        className="min-h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
      />

      <button
        type="button"
        aria-label="下个月"
        disabled={isAll}
        onClick={() => onChange(shiftMonth(ym, 1))}
        className="flex size-9 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
      >
        ›
      </button>

      <button
        type="button"
        onClick={() => onChange(isAll ? currentMonth() : null)}
        className={`min-h-9 rounded-lg border px-3 text-sm ${
          isAll
            ? 'border-indigo-500 bg-indigo-50 font-medium text-indigo-700'
            : 'border-slate-300 text-slate-600 hover:bg-slate-50'
        }`}
      >
        全部
      </button>

      <span className="text-sm text-slate-400">{isAll ? '所有时间' : monthLabel(ym)}</span>
    </div>
  )
}
