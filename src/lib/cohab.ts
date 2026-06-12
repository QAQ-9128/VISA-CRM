import { customerDisplayName } from './customerName'
import type { CustomerNameParts } from './customerName'
import { utcDayDiff } from './dateDiff'
import { getLodgementLodgedDate } from './lodgementStatus'
import type { CaseStage } from '../types/domain'
import type { Case, CaseStageHistory } from '../types/models'

/**
 * 「3 个月提醒 · 更新同居材料」（186 ENS + 配偶签 820/801、309/100）。
 * 持续收集关系/同居证据：勾选启用后每满 3 个月循环提醒一次，案件/客户/概览三处显示。
 * 周期锚点：上次确认日(cases.cohab_reminder_last，「本次已更新」写入) ?? 最近递交日 ?? 建档日。
 * 日期口径：本地日历日（utcDayDiff 取 y/m/d，DST 安全），与全站一致。
 */

// 3 个月，与全站「30 天近似法」一致：3 × 30 = 90 天。
export const COHAB_CYCLE_DAYS = 3 * 30

/** 是否为可挂此提醒的签证（186 ENS / 配偶 TR / 配偶 PR；入库 subclass 见级联映射）。 */
export function isCohabEligible(c: Pick<Case, 'visa_subclass'>): boolean {
  return c.visa_subclass === '186' || c.visa_subclass === '820/801' || c.visa_subclass === '309/100'
}

/** 获批/拒签/撤签后提醒停止。 */
const STOP_STAGES: ReadonlySet<CaseStage> = new Set<CaseStage>(['granted', 'refused', 'withdrawn'])

/** 周期锚点：上次确认日 ?? 最近递交日（提名/签证取较晚） ?? 建档日。 */
function cohabAnchor(case_: Case, ownHistory: CaseStageHistory[]): string {
  if (case_.cohab_reminder_last) return case_.cohab_reminder_last
  const nom = getLodgementLodgedDate(ownHistory, 'nomination')
  const visa = getLodgementLodgedDate(ownHistory, 'visa')
  const lodged = nom && visa ? (nom >= visa ? nom : visa) : nom ?? visa
  return lodged ?? case_.created_at.slice(0, 10)
}

/** 距周期锚点的月数（/30 近似，floor；概览/提醒卡文案用）。 */
export function monthsSinceCohabAnchor(
  case_: Case,
  caseStageHistory: CaseStageHistory[],
  today: Date = new Date(),
): number {
  const ownHistory = caseStageHistory.filter((h) => h.case_id === case_.id)
  return Math.floor(utcDayDiff(cohabAnchor(case_, ownHistory), today) / 30)
}

/**
 * 是否对该案件显示「更新同居材料」提醒。条件全满足才 true：
 *  1) cohab_reminder_enabled = true（勾选框只在 186/配偶签渲染并写入；手动取消勾选即停）
 *  2) 签证类型可挂此提醒（防御：标记脏数据不提醒）
 *  3) 案件未到终态（获批/拒签/撤签后停止）
 *  4) 距周期锚点 ≥ 90 天（「本次已更新」会把锚点顺延到确认日 → 下一周期再次提醒，循环往复）
 * caseStageHistory 传该案件的历史（内部按 case_.id 过滤，传全量亦可）。
 */
export function shouldShowCohabReminder(
  case_: Case,
  caseStageHistory: CaseStageHistory[],
  today: Date = new Date(),
): boolean {
  if (!case_.cohab_reminder_enabled) return false
  if (!isCohabEligible(case_)) return false
  if (STOP_STAGES.has(case_.current_stage)) return false
  const ownHistory = caseStageHistory.filter((h) => h.case_id === case_.id)
  return utcDayDiff(cohabAnchor(case_, ownHistory), today) >= COHAB_CYCLE_DAYS
}

export interface CohabReminderItem {
  customerId: string
  customerName: string
  caseId: string
  caseNumber: string
  /** 距上次更新/递交的月数（/30 近似） */
  monthsSince: number
}

/** 概览「更新同居材料」提醒条数据：所有到点案件，按月数降序。 */
export function selectCohabReminders(
  cases: Case[],
  stageHistory: CaseStageHistory[],
  customerById: Record<string, CustomerNameParts>,
  today: Date = new Date(),
): CohabReminderItem[] {
  const histByCase = new Map<string, CaseStageHistory[]>()
  for (const h of stageHistory) {
    const arr = histByCase.get(h.case_id) ?? []
    arr.push(h)
    histByCase.set(h.case_id, arr)
  }

  const items: CohabReminderItem[] = []
  for (const c of cases) {
    const caseHist = histByCase.get(c.id) ?? []
    if (!shouldShowCohabReminder(c, caseHist, today)) continue
    items.push({
      customerId: c.customer_id,
      customerName: customerDisplayName(customerById[c.customer_id]),
      caseId: c.id,
      caseNumber: c.case_number,
      monthsSince: monthsSinceCohabAnchor(c, caseHist, today),
    })
  }
  return items.sort((a, b) => b.monthsSince - a.monthsSince || a.customerName.localeCompare(b.customerName))
}
