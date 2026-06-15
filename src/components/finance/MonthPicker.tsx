import { useState } from 'react'
import { Popover } from '../ui/Popover'
import { monthTitle } from '../../lib/monthlyOverview'
import { isMonthInBounds, type MonthBounds } from '../../lib/month'

interface MonthPickerProps {
  /** 当前选中月 'YYYY-MM'。 */
  month: string
  /** 今天所在月 'YYYY-MM'（本地日历口径，由 currentMonth() 提供）。 */
  todayMonth: string
  /** 可选范围——与 ‹ › 箭头共用的**单一来源**（FinancePage 算一次传入）。 */
  bounds: MonthBounds
  /** 选中某月回调——与 ‹ › 箭头共用同一个 setter（不另算日期）。 */
  onSelect: (ym: string) => void
}

/** 1–12 月网格的单格按钮。 */
function MonthCell({
  label,
  selected,
  isToday,
  disabled,
  onClick,
}: {
  label: string
  selected: boolean
  isToday: boolean
  disabled: boolean
  onClick: () => void
}) {
  const base = 'h-11 rounded-[11px] text-[13.5px] font-semibold tabular-nums transition-colors'
  // selected 永远优先高亮（即便被 ‹ › 箭头带到范围外，也保持可见可重选）
  const state = selected
    ? 'bg-emerald-600 text-white shadow-sm'
    : disabled
      ? 'cursor-not-allowed text-faint/45'
      : isToday
        ? 'text-emerald-700 ring-1 ring-inset ring-emerald-300 hover:bg-emerald-50'
        : 'text-ink hover:bg-surface-2'
  return (
    <button type="button" aria-pressed={selected} disabled={disabled} onClick={onClick} className={`${base} ${state}`}>
      {label}
    </button>
  )
}

/** Popover 弹层内容：年份切换 + 3×4 月网格。open 时才挂载 → 年份视图随选中月重置（双向同步）。 */
function MonthGrid({
  month,
  todayMonth,
  bounds,
  onPick,
}: {
  month: string
  todayMonth: string
  bounds: MonthBounds
  onPick: (ym: string) => void
}) {
  const minYear = Number(bounds.min.slice(0, 4))
  const maxYear = Number(bounds.max.slice(0, 4))
  const [year, setYear] = useState(() => Number(month.slice(0, 4)))

  return (
    <div className="w-[256px]">
      {/* 年份切换 ‹ 2026 › */}
      <div className="mb-2 flex items-center justify-between px-1">
        <button
          type="button"
          aria-label="上一年"
          disabled={year <= minYear}
          onClick={() => setYear((y) => y - 1)}
          className="grid size-[26px] place-items-center rounded-[8px] bg-emerald-50 text-[14px] font-bold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ‹
        </button>
        <span className="text-[14.5px] font-semibold tabular-nums text-ink">{year} 年</span>
        <button
          type="button"
          aria-label="下一年"
          disabled={year >= maxYear}
          onClick={() => setYear((y) => y + 1)}
          className="grid size-[26px] place-items-center rounded-[8px] bg-emerald-50 text-[14px] font-bold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ›
        </button>
      </div>
      {/* 3×4 月网格 */}
      <div className="grid grid-cols-3 gap-1.5">
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
          const ym = `${year}-${String(m).padStart(2, '0')}`
          const selected = ym === month
          return (
            <MonthCell
              key={m}
              label={`${m} 月`}
              selected={selected}
              isToday={ym === todayMonth}
              disabled={!selected && !isMonthInBounds(ym, bounds)}
              onClick={() => onPick(ym)}
            />
          )
        })}
      </div>
    </div>
  )
}

/**
 * 月份直选器：可点击的月份标签（带 ▾ 提示）→ 弹出年份切换 + 月网格。
 * 选月 = 调用 onSelect（与 ‹ › 箭头同一个 setter），不在此做任何日期推算。
 */
export function MonthPicker({ month, todayMonth, bounds, onSelect }: MonthPickerProps) {
  const isCurrent = month === todayMonth
  return (
    <Popover
      ariaLabel="选择月份"
      triggerClassName="flex items-center gap-[6px] rounded-[9px] px-2 py-[3px] text-[16px] font-semibold text-ink transition-colors hover:bg-surface-2"
      panelClassName="w-[280px]"
      triggerContent={
        <>
          <span>{monthTitle(month)}</span>
          {isCurrent && <span className="text-[11px] font-normal text-faint">本月</span>}
          <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden className="text-faint">
            <path d="m5 8 5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </>
      }
    >
      {(close) => (
        <MonthGrid
          month={month}
          todayMonth={todayMonth}
          bounds={bounds}
          onPick={(ym) => {
            onSelect(ym)
            close()
          }}
        />
      )}
    </Popover>
  )
}
