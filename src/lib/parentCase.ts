import type { Case, Customer } from '../types/models'
import { formatVisaType } from './visa'
import { CASE_STAGE_LABELS } from '../types/domain'

/**
 * 「依附于哪个主案件」下拉的默认候选范围（纯函数）。
 *
 * 业务：副申请独立办自己的案件时，可标注依附于家庭组「主申请」名下的某个案件——
 * 仅作展示关联（parent_case_id 软关联），两案进度/账目完全独立、互不同步。
 *
 * 候选 = 当前客户家庭组「主申请」(self.primary_applicant_id) 名下、未归档、且非正在编辑的案件，
 * 按创建时间倒序。当前客户自己就是主申/独立客户（无 primary_applicant_id）时返回空——
 * UI 显示「(无可选)」，但仍可在表单里手动搜索任意案件来关联。
 */
export function selectParentCaseCandidates(
  cases: Case[],
  customerId: string,
  customers: Customer[],
  excludeCaseId?: string,
): Case[] {
  const self = customers.find((c) => c.id === customerId)
  const primaryId = self?.primary_applicant_id ?? null
  if (!primaryId) return []
  return cases
    .filter((c) => c.customer_id === primaryId && !c.is_archived && c.id !== excludeCaseId)
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
}

/**
 * 主案件下拉的严格状态（不再支持自由搜索任意案件）：
 *   no-family-primary  当前客户无家庭主申请（primary_applicant_id 为空）→ 无可关联案件
 *   primary-no-cases   有家庭主申请但其名下没有任何（未归档）案件
 *   has-cases          有候选可选
 * 前两种 → UI 把 radio「关联」选项置灰禁用（只能选独立）。
 */
export type ParentDropdownState = 'no-family-primary' | 'primary-no-cases' | 'has-cases'

/** 主案件下拉每条选项的显示文案：主申请客户名 · 签证类型 · 案件编号 · 当前阶段。 */
export function parentCaseOptionLabel(c: Case, customerName: string): string {
  return `${customerName} · ${formatVisaType(c.visa_subclass, c.visa_stream)} · ${c.case_number} · ${CASE_STAGE_LABELS[c.current_stage]}`
}

export function parentCaseDropdown(
  cases: Case[],
  customerId: string,
  customers: Customer[],
  excludeCaseId?: string,
): { state: ParentDropdownState; candidates: Case[] } {
  const self = customers.find((c) => c.id === customerId)
  const primaryId = self?.primary_applicant_id ?? null
  if (!primaryId) return { state: 'no-family-primary', candidates: [] }
  const candidates = selectParentCaseCandidates(cases, customerId, customers, excludeCaseId)
  return { state: candidates.length ? 'has-cases' : 'primary-no-cases', candidates }
}
