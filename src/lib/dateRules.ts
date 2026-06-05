/**
 * 表单日期方向规则（纯函数）：
 * - 阶段「实际发生日期」记录已发生的事 → 不允许未来；
 * - 待办「截止日期」是计划 → 不允许过去。
 * 字符串 YYYY-MM-DD 直接比大小（同格式字典序 = 时间序，DST 安全）。
 */

/** 今天的 YYYY-MM-DD（本地日历日）。 */
export function todayYmd(today: Date = new Date()): string {
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 是否晚于今天（未来）；空值不算。 */
export function isFutureYmd(ymd: string | null | undefined, today: string = todayYmd()): boolean {
  return !!ymd && ymd > today
}

/** 是否早于今天（过去）；空值不算。 */
export function isPastYmd(ymd: string | null | undefined, today: string = todayYmd()): boolean {
  return !!ymd && ymd < today
}
