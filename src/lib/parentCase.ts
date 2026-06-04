import type { Case, CaseApplicant } from '../types/models'
import { formatVisaType } from './visa'
import { CASE_STAGE_LABELS } from '../types/domain'

/**
 * 「依附于哪个主案件」下拉的候选范围（纯函数）。一案一组版：
 *
 * 业务：客户办新案件时，可标注依附于**该客户拥有或参与**的某个既有案件
 * （如先评估后 482）——parent_case_id 软关联，可选进度同步。
 * 不再依赖客户间关联（连通集已废）。
 *
 * 候选 = 该客户拥有 ∪ 参与（case_applicants）的、未归档、且非正在编辑的案件，按创建时间倒序。
 */
export function selectParentCaseCandidates(
  cases: Case[],
  customerId: string,
  applicants: CaseApplicant[] = [],
  excludeCaseId?: string,
): Case[] {
  const participated = new Set(applicants.filter((a) => a.customer_id === customerId).map((a) => a.case_id))
  return cases
    .filter(
      (c) =>
        (c.customer_id === customerId || participated.has(c.id)) &&
        !c.is_archived &&
        c.id !== excludeCaseId,
    )
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
}

/**
 * 主案件下拉状态：
 *   no-cases   该客户暂无其它可关联案件 → UI 把「关联」radio 置灰
 *   has-cases  有候选可选
 */
export type ParentDropdownState = 'no-cases' | 'has-cases'

/** 主案件下拉每条选项的显示文案：归属客户名 · 签证类型 · 案件编号 · 当前阶段。 */
export function parentCaseOptionLabel(c: Case, customerName: string): string {
  return `${customerName} · ${formatVisaType(c.visa_subclass, c.visa_stream)} · ${c.case_number} · ${CASE_STAGE_LABELS[c.current_stage]}`
}

export function parentCaseDropdown(
  cases: Case[],
  customerId: string,
  applicants: CaseApplicant[] = [],
  excludeCaseId?: string,
): { state: ParentDropdownState; candidates: Case[] } {
  const candidates = selectParentCaseCandidates(cases, customerId, applicants, excludeCaseId)
  return { state: candidates.length ? 'has-cases' : 'no-cases', candidates }
}
