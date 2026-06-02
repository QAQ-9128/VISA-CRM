import { CASE_STAGES, CASE_STAGE_LABELS } from '../types/domain'
import type { CaseStage } from '../types/domain'

/**
 * 阶段步进条数据：按 case_stage enum 真实顺序排出**全部**阶段（数量 = enum 长度，不写死）。
 * 纯展示派生，不改 enum / 历史 / 切换逻辑。
 */
export type StageStepState = 'past' | 'current' | 'future'

export interface StageStep {
  stage: CaseStage
  label: string
  /** past=已经过(实心) / current=当前(高亮) / future=未到(空心) */
  state: StageStepState
  /** 非正常结局（拒签 / 主动撤签）→ 标红 */
  abnormal: boolean
}

/** 非正常结局阶段（标红）。 */
export const ABNORMAL_STAGES: ReadonlySet<CaseStage> = new Set<CaseStage>(['refused', 'withdrawn'])

/**
 * 按当前阶段算出每个 enum 阶段的状态。
 * current 不在 CASE_STAGES（如旧值 additional_docs）时，索引取 -1 → 全部按未到处理（不崩）。
 */
export function stageSteps(current: CaseStage): StageStep[] {
  const ci = (CASE_STAGES as readonly string[]).indexOf(current)
  return CASE_STAGES.map((stage, i) => ({
    stage,
    label: CASE_STAGE_LABELS[stage],
    state: ci < 0 ? 'future' : i < ci ? 'past' : i === ci ? 'current' : 'future',
    abnormal: ABNORMAL_STAGES.has(stage),
  }))
}
