import { flowProcessing, formatWaitDays } from './casesTable'
import { getLodgementStatus } from './lodgementStatus'
import type { LodgementDerivedStatus } from './lodgementStatus'
import type { CaseStage, LodgementType } from '../types/domain'
import type { CaseStageHistory } from '../types/models'

export interface ProcessingRow {
  flow: LodgementType
  /** 行首深绿强调的流程字 */
  flowLabel: '提名' | '签证'
  /** 审理时长整天数：审理中 = 今天−递交（实时）；已批 = 获批日−递交（定格仍显示） */
  days: number
  /** "X 个月 Y 天"（/30 近似，与进度表/里程碑卡同口径） */
  text: string
  /** 流程状态（小标配色走 lib/statusColor：审理中灰 / 已批绿 / 已拒红） */
  status: LodgementDerivedStatus
  /** 小标文案：审理中 / 已批 / 已拒 */
  tag: string
}

/** 状态 → 小标文案（概要带行内紧凑版；进度表/递交卡仍用 FLOW_STATUS_LABELS）。 */
const ROW_TAGS: Record<LodgementDerivedStatus, string> = {
  pending: '审理中',
  approved: '已批',
  refused: '已拒',
}

/**
 * 概要带「审理时长」格（客户头部卡）：按实际在审的阶段返回一行或两行（提名在前）。
 *  - 提名/签证只要已递交（有派生递交日）就各占一行——无论审理中还是已获批/下签；都未递交 → []（整格显 —）；
 *  - 每行时长/定格口径 = flowProcessing（案件进度表与里程碑卡的单一来源），状态 = getLodgementStatus，不另写一套；
 *  - 已批后定格（获批日−递交日）但**一直显示、不隐藏**；递交日取真实 case_stage_history 派生（本地日期），绝不编造。
 */
export function selectProcessingRows(
  stage: CaseStage,
  history: CaseStageHistory[],
  today: Date = new Date(),
): ProcessingRow[] {
  const rows: ProcessingRow[] = []
  for (const flow of ['nomination', 'visa'] as const) {
    const p = flowProcessing(flow, stage, history, today)
    if (p.lodged && p.daysSince != null) {
      const status = getLodgementStatus(stage, flow, history)
      rows.push({
        flow,
        flowLabel: flow === 'nomination' ? '提名' : '签证',
        days: p.daysSince,
        text: formatWaitDays(p.daysSince),
        status,
        tag: ROW_TAGS[status],
      })
    }
  }
  return rows
}
