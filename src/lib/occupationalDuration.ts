import { localYmd, todayYmd } from './dateRules'
import { utcDayDiff } from './dateDiff'
import type { CaseStageHistory } from '../types/models'
import type { CaseStage } from '../types/domain'

/**
 * 职业评估「审理时长两段」纯派生（§5）。从阶段流转记录派生，不存额外字段：
 *   某 OA 阶段时长 = 该阶段实际发生日(本地) → 其后第一条阶段记录日(本地，冻结)
 *                    否则今天(本地，仍停留该阶段则累加)。
 *   该阶段未发生 → null（UI 显「—」）。
 * 两段固定为 oa_chn_verification / oa_skill_submitted。
 * 日期一律本地（localYmd，禁 UTC 日）；天数差走 utcDayDiff——喂「本地 ymd」即得本地日历差(DST 安全)。
 */

export interface StageDuration {
  /** 该阶段实际发生日（本地 YYYY-MM-DD） */
  start: string
  /** 整天数（本地日历差，≥0） */
  days: number
  /** 仍停留在该阶段（其后无更晚记录）→ 累加到今天；否则已冻结 */
  ongoing: boolean
}

export interface OccupationalDurations {
  chn: StageDuration | null
  skill: StageDuration | null
}

/**
 * 单段时长：目标阶段在时间序上**首次**发生日 → 其后紧随的第一条记录日（冻结），
 * 其后无记录则累加到今天（ongoing）。未发生 → null。
 */
export function stageDuration(
  history: CaseStageHistory[],
  stage: CaseStage,
  today: string = todayYmd(),
): StageDuration | null {
  // 按实际发生时间升序（同格式 ISO 时间戳字典序 = 时间序）
  const sorted = [...history]
    .filter((h) => h.effective_at)
    .sort((a, b) => (a.effective_at as string).localeCompare(b.effective_at as string))
  const i = sorted.findIndex((h) => h.to_stage === stage)
  if (i < 0) return null
  const start = localYmd(new Date(sorted[i].effective_at))
  const next = sorted[i + 1]
  const ongoing = !next
  const end = next ? localYmd(new Date(next.effective_at)) : today
  return { start, days: Math.max(0, utcDayDiff(start, end)), ongoing }
}

export function selectOccupationalDurations(
  history: CaseStageHistory[],
  today: string = todayYmd(),
): OccupationalDurations {
  return {
    chn: stageDuration(history, 'oa_chn_verification', today),
    skill: stageDuration(history, 'oa_skill_submitted', today),
  }
}
