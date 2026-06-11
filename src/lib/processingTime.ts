import { utcDayDiff } from './dateDiff'
import { getLodgementLodgedDate } from './lodgementStatus'
import type { CaseStage } from '../types/domain'
import type { CaseStageHistory } from '../types/models'

export interface ProcessingTime {
  label: '提名审理时长' | '签证审理时长'
  /** 今天 − 真实递交日（case_stage_history 派生）的整天数，实时增长 */
  days: number
}

/**
 * 概要带「审理时长」格（客户详情）：只在「提名递交 / 签证递交」两个阶段显示——
 * 阶段=提名递交 → 提名递交日距今；阶段=签证递交 → 签证递交日距今；其它阶段或无日期 → null。
 * 递交日期取真实 case_stage_history（getLodgementLodgedDate），绝不编造。
 */
export function selectProcessingTime(
  stage: CaseStage,
  history: CaseStageHistory[],
  today: Date = new Date(),
): ProcessingTime | null {
  const type = stage === 'nomination_lodged' ? 'nomination' : stage === 'visa_lodged' ? 'visa' : null
  if (!type) return null
  const lodged = getLodgementLodgedDate(history, type)
  if (!lodged) return null
  const days = Math.max(0, utcDayDiff(lodged, today))
  return { label: type === 'nomination' ? '提名审理时长' : '签证审理时长', days }
}
