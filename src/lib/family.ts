import type { Case, CaseApplicant, Customer } from '../types/models'

/**
 * 家庭组逻辑：组由 primary_applicant_id 定义。客户所在组的根(主申)id =
 * 自身是主申(primary_applicant_id 为空)时为自身，否则为其 primary_applicant_id。
 * 案件的副申请人通过 case_applicants 关联，独立于家庭组；这里只用于「候选池」筛选。
 */
export function familyRootId(c: Pick<Customer, 'id' | 'primary_applicant_id'>): string {
  return c.primary_applicant_id ?? c.id
}

/** 与指定客户同家庭组的其他在册成员（双向：主申↔副申、同主申的副申之间）；排除自身/归档；主申优先、再按名字。 */
export function selectFamilyGroupMembers(customerId: string, customers: Customer[]): Customer[] {
  const self = customers.find((c) => c.id === customerId)
  const root = self ? familyRootId(self) : customerId
  return customers
    .filter((c) => c.id !== customerId && !c.is_archived && familyRootId(c) === root)
    .sort(
      (a, b) =>
        (a.primary_applicant_id ? 1 : 0) - (b.primary_applicant_id ? 1 : 0) ||
        a.full_name.localeCompare(b.full_name),
    )
}

/** 该客户作为「副申请」参与的案件：在 case_applicants 中、且不是该案主申、未归档。 */
export function selectCoApplicantCases(
  cases: Case[],
  applicants: CaseApplicant[],
  customerId: string,
): Case[] {
  const joinedCaseIds = new Set(
    applicants.filter((a) => a.customer_id === customerId).map((a) => a.case_id),
  )
  return cases.filter(
    (c) => joinedCaseIds.has(c.id) && c.customer_id !== customerId && !c.is_archived,
  )
}

/** 可加入的案件：同家庭组成员（含主申）名下、未归档、非本人主申、且尚未加入的案件。 */
export function selectJoinableCases(
  cases: Case[],
  applicants: CaseApplicant[],
  customerId: string,
  customers: Customer[],
): Case[] {
  const self = customers.find((c) => c.id === customerId)
  const root = self ? familyRootId(self) : customerId
  const groupMemberIds = new Set(customers.filter((c) => familyRootId(c) === root).map((c) => c.id))
  const joinedCaseIds = new Set(
    applicants.filter((a) => a.customer_id === customerId).map((a) => a.case_id),
  )
  return cases.filter(
    (c) =>
      !c.is_archived &&
      groupMemberIds.has(c.customer_id) &&
      c.customer_id !== customerId &&
      !joinedCaseIds.has(c.id),
  )
}
