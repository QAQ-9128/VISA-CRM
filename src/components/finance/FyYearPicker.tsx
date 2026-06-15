import { Popover } from '../ui/Popover'
import { fyOfEndYear, fyPickerBounds } from '../../lib/dateRules'

interface FyYearPickerProps {
  /** 当前选中财年的结束年。 */
  endYear: number
  /** 当前财年的结束年（本地日历口径，由 auFinancialYear().endYear 提供）。 */
  currentEndYear: number
  /** 有账目记录的最早月；空 = 无记录（范围退当前财年）。 */
  earliestMonth: string | null | undefined
  /** 选中某财年回调——与 ‹ › 箭头共用同一个 setter。 */
  onSelect: (endYear: number) => void
}

/**
 * 财年直选器：可点击的财年标签（带 ▾）→ 弹出财年列表（最早记录财年 → 当前财年）。
 * 选财年 = 调用 onSelect（与 ‹ › 箭头同一个 setter），不另做日期推算。
 */
export function FyYearPicker({ endYear, currentEndYear, earliestMonth, onSelect }: FyYearPickerProps) {
  const fy = fyOfEndYear(endYear)
  const isCurrent = endYear === currentEndYear
  const bounds = fyPickerBounds(earliestMonth, currentEndYear)
  // 结束年从大到小（当前财年置顶）
  const years: number[] = []
  for (let y = bounds.maxEndYear; y >= bounds.minEndYear; y--) years.push(y)

  return (
    <Popover
      ariaLabel="选择财年"
      triggerClassName="flex flex-col items-center rounded-[9px] px-2 py-[2px] transition-colors hover:bg-surface-2"
      panelClassName="w-[240px]"
      triggerContent={
        <>
          <span className="flex items-center gap-[6px] text-[15px] font-semibold leading-tight text-ink">
            {fy.label}
            {isCurrent && (
              <span className="rounded-[6px] bg-emerald-50 px-[6px] py-px align-middle text-[10.5px] font-semibold text-emerald-700">
                本财年
              </span>
            )}
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden className="text-faint">
              <path d="m5 8 5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="mt-px text-[11px] tabular-nums text-faint">
            {fy.startYmd} ~ {fy.endYmd}
          </span>
        </>
      }
    >
      {(close) => (
        <div className="flex max-h-[260px] flex-col gap-1 overflow-y-auto">
          {years.map((y) => {
            const item = fyOfEndYear(y)
            const selected = y === endYear
            return (
              <button
                key={y}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  onSelect(y)
                  close()
                }}
                className={`flex h-11 items-center justify-between rounded-[11px] px-3 text-[13.5px] font-semibold transition-colors ${
                  selected
                    ? 'bg-emerald-600 text-white'
                    : y === currentEndYear
                      ? 'text-emerald-700 ring-1 ring-inset ring-emerald-300 hover:bg-emerald-50'
                      : 'text-ink hover:bg-surface-2'
                }`}
              >
                <span>{item.label}</span>
                <span className={`text-[11px] tabular-nums ${selected ? 'text-white/80' : 'text-faint'}`}>
                  {item.startYmd.slice(0, 4)}–{item.endYmd.slice(0, 4)}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </Popover>
  )
}
