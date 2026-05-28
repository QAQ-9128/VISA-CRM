const MS_PER_DAY = 86_400_000

/** 把日期（'YYYY-MM-DD' 或 Date）规整到 UTC 当天零点的毫秒值。 */
function toUtcMidnight(d: string | Date): number {
  if (typeof d === 'string') {
    const [y, m, day] = d.split('-').map(Number)
    return Date.UTC(y, m - 1, day)
  }
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
}

/**
 * 整天数差 (to - from)。一律按 UTC 当天零点计算，避免本地时区夏令时
 * （某天 23/25 小时）导致跨月/跨季的差一天问题。
 */
export function utcDayDiff(from: string | Date, to: string | Date): number {
  return Math.round((toUtcMidnight(to) - toUtcMidnight(from)) / MS_PER_DAY)
}
