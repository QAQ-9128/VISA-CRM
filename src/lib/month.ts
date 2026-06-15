/**
 * 年月(YYYY-MM)工具。用于财务页按月筛选。
 * 用本地时区的「日历年月」字符串，避免时区/DST 误差（与 paid_at 的日期前缀直接比较）。
 */

/** 当前年月 'YYYY-MM'（本地时区，月份补零）。 */
export function currentMonth(today: Date = new Date()): string {
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

/** 把 'YYYY-MM' 偏移 delta 个月，跨年正确（delta 可负）。 */
export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const idx = y * 12 + (m - 1) + delta
  const ny = Math.floor(idx / 12)
  const nm = (idx % 12) + 1
  return `${ny}-${String(nm).padStart(2, '0')}`
}

/** 'YYYY-MM' → 中文「2026 年 5 月」（不补零）。 */
export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return `${y} 年 ${m} 月`
}

/** 月份直选器的可选范围（含两端）。字符串年月比较，本地日历口径（DST 安全）。 */
export interface MonthBounds {
  min: string
  max: string
}

/**
 * 月份可选范围的**单一来源**——箭头翻页与 Popover 月网格都用它，绝不各写一套。
 * - 下限 = min(最早有记录的年, 当前年 − 5) 的 1 月：至少能往回翻 5 年，有更早记录则再往前放；
 * - 上限 = 今天所在月（本地澳洲日期，禁 UTC）；
 * - 过去月一律可选（无记录显示 0.00），未来月（晚于今天）不可选。
 * earliest 仅用于「比 5 年更早」时下放下限；为空则就用 当前年 − 5。
 */
export function monthPickerBounds(earliest: string | null | undefined, todayMonth: string): MonthBounds {
  const todayYear = Number(todayMonth.slice(0, 4))
  const earliestYear = earliest ? Number(earliest.slice(0, 4)) : todayYear
  const minYear = Math.min(earliestYear, todayYear - 5)
  return { min: `${minYear}-01`, max: todayMonth }
}

/** 年月是否落在可选范围内（含两端）。箭头与月网格共用的唯一判定。 */
export function isMonthInBounds(ym: string, bounds: MonthBounds): boolean {
  return ym >= bounds.min && ym <= bounds.max
}
