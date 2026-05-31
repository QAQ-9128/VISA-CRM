import { formatVisaType } from './visa'
import { selectCoApplicantCases } from './family'
import type { CaseStage } from '../types/domain'
import type { Case, CaseApplicant, Customer } from '../types/models'

/**
 * 客户列表某行该显示哪些案件（优先级）：
 *  1) 该客户作为「主申请」的案件（case.customer_id === 客户）→ 显示这些；
 *  2) 否则，该客户作为「副申请」参与的案件（case_applicants）→ 显示那些；
 *  3) 都没有 → 空数组（UI 显示"暂无案件"）。
 * 修复：副申客户本人无主申案件时，原先误显示"暂无案件"。
 */
export function selectDisplayCases(
  customerId: string,
  cases: Case[],
  caseApplicants: CaseApplicant[],
): Case[] {
  const primary = cases.filter((c) => c.customer_id === customerId && !c.is_archived)
  if (primary.length > 0) return primary
  return selectCoApplicantCases(cases, caseApplicants, customerId)
}

/**
 * 客户列表每行的内联展示：每个案件一行 `签证类型 | 职位 | 担保雇主`（状态徽章由 UI 追加为最后一项）。
 * 空字段（含纯空白）优雅跳过，分隔符 `|` 自适应。无案件 → 空数组（UI 显示"暂无案件"）。
 */
export interface CustomerCaseLine {
  caseId: string
  stage: CaseStage
  /** 已过滤空值、按序的文本字段：签证类型 [, 职位] [, 担保雇主] */
  fields: string[]
}

const nonEmpty = (s: string | null | undefined): string => (s && s.trim() !== '' ? s.trim() : '')

export function selectCustomerCaseLines(
  customer: Pick<Customer, 'sponsor_position'>,
  cases: Array<Pick<Case, 'id' | 'visa_subclass' | 'visa_stream' | 'current_stage'>>,
  employerName: string | null,
): CustomerCaseLine[] {
  const position = nonEmpty(customer.sponsor_position)
  const employer = nonEmpty(employerName)
  return cases.map((cs) => ({
    caseId: cs.id,
    stage: cs.current_stage,
    fields: [formatVisaType(cs.visa_subclass, cs.visa_stream), position, employer].filter((f) => f !== ''),
  }))
}
