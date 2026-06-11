import type { CaseStage, LodgementType } from '../types/domain'
import type { CaseStageHistory } from '../types/models'

/**
 * lodgement 状态从 case_stage 实时派生（不存独立字段）。纯函数。
 *  - 提名 lodgement：case_stage 在「提名获批」及之后（签证递交/要求补件/补件完毕/下签，含旧 additional_docs）→ 已批；
 *    历史里明确出现过「提名获批」也 → 已批（如提名获批后签证被拒：与 flowProcessing 的冻结口径一致）；
 *  - 签证 lodgement：case_stage 为「下签」→ 已批；
 *  - case_stage 为「拒签」：看 case_stage_history 最近一次涉及的 lodgement 类型，该类型 → 已拒，另一个 → 待决；
 *  - 其余 → 待决。
 */
export type LodgementDerivedStatus = 'approved' | 'refused' | 'pending'
// 状态配色见 lib/statusColor.ts（FLOW_STATUS_CATEGORY，6 类全站统一）；
// 旧的 LODGEMENT_STATUS_LABELS/STYLES（零散逐状态配色，已无使用方）已删。

// 提名视为「已批」的阶段集合（提名获批及之后，不含拒签；含旧 additional_docs）
const NOM_APPROVED_STAGES = new Set<CaseStage>([
  'nomination_approved',
  'visa_lodged',
  'docs_requested',
  'docs_completed',
  'granted',
  'additional_docs',
])

/** 拒签时定位被拒 lodgement：取历史里最近一次「涉及 lodgement 类型」的阶段；无则默认签证。 */
function refusedLodgementType(history: CaseStageHistory[]): LodgementType {
  const at = (h: CaseStageHistory) => h.effective_at ?? h.changed_at
  const sorted = [...history].sort((a, b) => at(b).localeCompare(at(a)))
  for (const h of sorted) {
    if (h.to_stage === 'nomination_lodged' || h.to_stage === 'nomination_approved') return 'nomination'
    if (h.to_stage === 'visa_lodged') return 'visa'
  }
  return 'visa'
}

// 「递交」阶段：提名 lodgement 对应 nomination_lodged，签证 lodgement 对应 visa_lodged。
const LODGED_STAGE: Record<LodgementType, CaseStage> = {
  nomination: 'nomination_lodged',
  visa: 'visa_lodged',
}

/**
 * lodgement 的「递交日期」从 case_stage_history 派生（不再存 lodgements.lodged_date）：
 * 取 to_stage 为对应「递交」阶段的最近一条（effective_at 最大）的 effective_at 日期部分；无则 null。
 * 用户在时间线上改/删该阶段历史 → 此处随输入实时更新。
 */
export function getLodgementLodgedDate(
  caseStageHistory: CaseStageHistory[],
  lodgementType: LodgementType,
): string | null {
  const target = LODGED_STAGE[lodgementType]
  let best: string | null = null
  for (const h of caseStageHistory) {
    if (h.to_stage !== target) continue
    const eff = h.effective_at ?? h.changed_at
    if (!best || eff > best) best = eff
  }
  return best ? best.slice(0, 10) : null
}

// 历史里明确记录过「提名获批」（仅认显式记录，不用 POST 阶段集推断：
// 联合递交未记提名获批时不能凭签证递交断言提名已批——见测试「最近是签证递交」）
function nomApprovedInHistory(history: CaseStageHistory[]): boolean {
  return history.some((h) => h.to_stage === 'nomination_approved')
}

export function getLodgementStatus(
  caseStage: CaseStage,
  lodgementType: LodgementType,
  caseStageHistory: CaseStageHistory[] = [],
): LodgementDerivedStatus {
  if (caseStage === 'refused') {
    if (refusedLodgementType(caseStageHistory) === lodgementType) return 'refused'
    // 提名获批→签证被拒：提名不是被拒方且历史明确获批 → 仍显已批（否则待决）
    return lodgementType === 'nomination' && nomApprovedInHistory(caseStageHistory) ? 'approved' : 'pending'
  }
  if (lodgementType === 'nomination') {
    return NOM_APPROVED_STAGES.has(caseStage) || nomApprovedInHistory(caseStageHistory) ? 'approved' : 'pending'
  }
  return caseStage === 'granted' ? 'approved' : 'pending'
}
