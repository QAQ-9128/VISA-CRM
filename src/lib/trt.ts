import { utcDayDiff } from './dateDiff'
import type { Case, CaseStageHistory } from '../types/models'

/**
 * 482 → 186 TRT 永居提醒（纯派生，不存额外字段）。
 * 482 持有人工作满 2 年(技术上 22 个月即可启动)可转 186 TRT 永居，需提醒中介及时启动。
 */

// 22 个月，与全站「30 天近似法」一致：22 × 30 = 660 天。
export const TRT_THRESHOLD_DAYS = 22 * 30

/** 该案最近一次「下签(granted)」的 effective_at 日期；无则 null。 */
function latestGrantDate(caseStageHistory: CaseStageHistory[]): string | null {
  let best: string | null = null
  for (const h of caseStageHistory) {
    if (h.to_stage !== 'granted') continue
    const d = (h.effective_at ?? h.changed_at).slice(0, 10)
    if (!best || d > best) best = d
  }
  return best
}

/** 距下签的月数（/30 近似，floor）；无下签 → null。caseStageHistory 应为该案件的历史。 */
export function monthsSinceGrant(
  caseStageHistory: CaseStageHistory[],
  today: Date = new Date(),
): number | null {
  const g = latestGrantDate(caseStageHistory)
  if (!g) return null
  return Math.floor(utcDayDiff(g, today) / 30)
}

/** 是否为「186 TRT」案件（visa_subclass 含 186 且 stream 为 TRT）。 */
function isTrt186(c: Pick<Case, 'visa_subclass' | 'visa_stream'>): boolean {
  return c.visa_subclass.includes('186') && /temporary residence transition|trt/i.test(c.visa_stream ?? '')
}

/**
 * 是否对该案件显示「转 186 TRT」提醒。条件全满足才 true：
 *  1) case.trt_reminder_enabled = true（且 case 必为 482 TSS——勾选框只在 482 TSS 渲染并写入）
 *  2) 该案 case_stage_history 有下签记录（取最近一条 effective_at 为起点）
 *  3) 距下签 ≥ 22 个月(660 天)——用 today 的本地日历日，与财年/到期口径一致（utcDayDiff 取本地 y/m/d）
 *  4) 同一客户名下没有任何 186 TRT 案（一旦开了 186 TRT，此提醒自动消失）
 *  5) 未被手动停止（用户在提醒卡点「不再提醒」→ trt_reminder_dismissed=true）
 * caseStageHistory 应为该案件的历史（内部按 case_.id 过滤，传全量亦可）。
 */
export function shouldShowTrtReminder(
  case_: Case,
  customerCases: Pick<Case, 'visa_subclass' | 'visa_stream'>[],
  caseStageHistory: CaseStageHistory[],
  today: Date = new Date(),
): boolean {
  if (!case_.trt_reminder_enabled) return false
  if (case_.trt_reminder_dismissed) return false
  const ownHistory = caseStageHistory.filter((h) => h.case_id === case_.id)
  const g = latestGrantDate(ownHistory)
  if (!g) return false
  if (utcDayDiff(g, today) < TRT_THRESHOLD_DAYS) return false
  if (customerCases.some(isTrt186)) return false
  return true
}

export interface TrtReminderItem {
  customerId: string
  customerName: string
  caseId: string
  caseNumber: string
  monthsSinceGrant: number
}

/** 概览「转 TRT 提醒」卡片数据：所有符合条件的案件，按距下签月数降序。 */
export function selectTrtReminders(
  cases: Case[],
  stageHistory: CaseStageHistory[],
  customerById: Record<string, { full_name: string }>,
  today: Date = new Date(),
): TrtReminderItem[] {
  const histByCase = new Map<string, CaseStageHistory[]>()
  for (const h of stageHistory) {
    const arr = histByCase.get(h.case_id) ?? []
    arr.push(h)
    histByCase.set(h.case_id, arr)
  }
  const casesByCustomer = new Map<string, Case[]>()
  for (const c of cases) {
    const arr = casesByCustomer.get(c.customer_id) ?? []
    arr.push(c)
    casesByCustomer.set(c.customer_id, arr)
  }

  const items: TrtReminderItem[] = []
  for (const c of cases) {
    const caseHist = histByCase.get(c.id) ?? []
    const custCases = casesByCustomer.get(c.customer_id) ?? []
    if (!shouldShowTrtReminder(c, custCases, caseHist, today)) continue
    items.push({
      customerId: c.customer_id,
      customerName: customerById[c.customer_id]?.full_name ?? '',
      caseId: c.id,
      caseNumber: c.case_number,
      monthsSinceGrant: monthsSinceGrant(caseHist, today) ?? 0,
    })
  }
  return items.sort((a, b) => b.monthsSinceGrant - a.monthsSinceGrant || a.customerName.localeCompare(b.customerName))
}
