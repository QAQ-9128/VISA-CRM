import type { CaseStage } from '../types/domain'
import type { CaseStageHistory } from '../types/models'

/**
 * 获批判定（纯展示派生，绑定真实阶段枚举，不新增任何字段）。
 * 「距今/已过」时长只在等结果时有意义；获批后 UI 改显示获批状态（见递交进度表 / 里程碑卡）。
 */

/** 达到/越过「提名获批」的主流程阶段（提名获批本身 + 其后续；拒签/撤签靠历史兜底）。 */
const POST_NOMINATION_APPROVAL: ReadonlySet<CaseStage> = new Set<CaseStage>([
  'nomination_approved',
  'visa_lodged',
  'docs_requested',
  'docs_completed',
  'granted',
])

/**
 * 提名是否已获批：当前阶段达到/越过「提名获批」，或该案历史曾达到（如签证阶段被拒的案件）。
 * history 传该案件自己的阶段历史（已按案件过滤）。
 */
export function isNominationApproved(
  currentStage: CaseStage,
  history: Pick<CaseStageHistory, 'to_stage'>[] = [],
): boolean {
  if (POST_NOMINATION_APPROVAL.has(currentStage)) return true
  return history.some((h) => POST_NOMINATION_APPROVAL.has(h.to_stage))
}

/** 签证是否已获批 = 案件当前阶段为「下签」。 */
export function isVisaGranted(currentStage: CaseStage): boolean {
  return currentStage === 'granted'
}
