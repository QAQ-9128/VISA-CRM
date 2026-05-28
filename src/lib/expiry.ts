import { utcDayDiff } from './dateDiff'

export type ExpiryStatus = 'overdue' | 'soon' | 'ok'

export interface ExpiryInfo {
  /** 距到期的天数：负数=已过期 */
  daysRemaining: number
  status: ExpiryStatus
}

/**
 * 文件到期状态（前端计算，不入库）。
 * 已过期 → overdue；今天起 ≤ soonThresholdDays 天 → soon；更远 → ok。
 * 用 UTC 天数差（见 dateDiff），与 lodgement 进度同一套算法，避免 DST 偏差。
 */
export function computeExpiryStatus(
  expiryDate: string | null,
  today: Date = new Date(),
  soonThresholdDays = 30,
): ExpiryInfo | null {
  if (!expiryDate) return null
  const daysRemaining = utcDayDiff(today, expiryDate)
  let status: ExpiryStatus
  if (daysRemaining < 0) status = 'overdue'
  else if (daysRemaining <= soonThresholdDays) status = 'soon'
  else status = 'ok'
  return { daysRemaining, status }
}
