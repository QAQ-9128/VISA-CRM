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
