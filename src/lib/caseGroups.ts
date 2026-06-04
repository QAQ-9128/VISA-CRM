import { groupCode } from './groupCode'
import type { Case, CaseApplicant } from '../types/models'

/**
 * 「一案一组」的纯派生层（2026-06 模型修正，取代旧的客户关联连通集）：
 *   组 = 某个案件的参与人集合（案件客户 + 本案参与客户 case_applicants）。
 *   同一个人可以同时在多个组里（A+B 案一组、A+C 案另一组，不传递合并）。
 *   **多人**参与人集合完全相同的案件 ⇒ 同组同码（如一家人办多个签证）；
 *   **单人**案件每案各自一组（同一个人的不同案件不跨案合并 → 组键掺入案件 id）。
 * 组 ID 纯派生、零入库。
 */

/** 案件参与人 id：案件客户在前，其余按 case_applicants 顺序（去重，只取本案）。 */
export function caseParticipantIds(
  caseRow: Pick<Case, 'id' | 'customer_id'>,
  applicants: CaseApplicant[],
): string[] {
  const ids = [caseRow.customer_id]
  for (const a of applicants) {
    if (a.case_id === caseRow.id && !ids.includes(a.customer_id)) ids.push(a.customer_id)
  }
  return ids
}

/**
 * 组键：多人 = 参与人集合的规范形式（排序去重，集合相同 ⇒ 同组）；
 * 单人 = 集合 + 案件 id（同一个人的不同案件各自一组，不跨案合并）。
 */
export function caseGroupKey(participantIds: string[], caseId: string): string {
  const ids = [...new Set(participantIds)].sort()
  return ids.length > 1 ? ids.join('|') : `${ids[0] ?? ''}#${caseId}`
}

/** 组码：由组键稳定哈希（G-XXXX）。多人同集合同码；单人一案一码。 */
export function caseGroupCode(participantIds: string[], caseId: string): string {
  return groupCode(caseGroupKey(participantIds, caseId))
}
