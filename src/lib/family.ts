import type { Case, CaseApplicant, Customer, FamilyMemberLink } from '../types/models'

/**
 * 家庭组逻辑：组由 primary_applicant_id 定义。客户所在组的根(主申)id =
 * 自身是主申(primary_applicant_id 为空)时为自身，否则为其 primary_applicant_id。
 * 案件的副申请人通过 case_applicants 关联，独立于家庭组；这里只用于「候选池」筛选。
 */
export function familyRootId(c: Pick<Customer, 'id' | 'primary_applicant_id'>): string {
  return c.primary_applicant_id ?? c.id
}

/**
 * 「案件家庭组」成员 id 集（不含自身）= ① 同 primary_applicant_id 家族（双向）
 * ∪ ② family_member_links 邻居（双向：本人关联进来的成员 + 本人被关联进的主申）。
 * 让「关联现有客户」也能进入案件副申候选 / 可加入案件，复用现有 case_applicants（不自动加）。
 */
export function relatedCustomerIds(
  customerId: string,
  customers: Customer[],
  links: FamilyMemberLink[] = [],
): Set<string> {
  const ids = new Set<string>()
  const self = customers.find((c) => c.id === customerId)
  const root = self ? familyRootId(self) : customerId
  for (const c of customers) {
    if (c.id !== customerId && familyRootId(c) === root) ids.add(c.id)
  }
  for (const lk of links) {
    if (lk.primary_customer_id === customerId) ids.add(lk.member_customer_id)
    if (lk.member_customer_id === customerId) ids.add(lk.primary_customer_id)
  }
  ids.delete(customerId)
  return ids
}

/**
 * 与指定客户同「案件家庭组」的其他在册成员（含 primary_applicant_id 家族 + 关联现有客户）；
 * 排除自身/归档；主申优先、再按名字。links 默认空 = 旧行为（仅 primary_applicant_id 家族）。
 */
export function selectFamilyGroupMembers(
  customerId: string,
  customers: Customer[],
  links: FamilyMemberLink[] = [],
): Customer[] {
  const memberIds = relatedCustomerIds(customerId, customers, links)
  return customers
    .filter((c) => memberIds.has(c.id) && !c.is_archived)
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

/**
 * 客户详情「相关案件」来源 = 拥有 ∪ 参与（组⊃客户⊃案件：案件独属一个客户，
 * 但多人参加的案件在每个参与人页面都可见）。拥有在前、各按 created_at 升序。
 */
export function selectCustomerCases(
  customerId: string,
  cases: Case[],
  applicants: CaseApplicant[],
): Case[] {
  const byCreated = (a: Case, b: Case) =>
    (a.created_at ?? '').localeCompare(b.created_at ?? '') || a.id.localeCompare(b.id)
  const owned = cases.filter((c) => c.customer_id === customerId && !c.is_archived).sort(byCreated)
  const participated = selectCoApplicantCases(cases, applicants, customerId).slice().sort(byCreated)
  return [...owned, ...participated]
}

/**
 * 可加入的案件：同「案件家庭组」成员（含 primary_applicant_id 家族 + 关联现有客户）名下、
 * 未归档、非本人主申、且尚未加入的案件。links 默认空 = 旧行为。
 */
export function selectJoinableCases(
  cases: Case[],
  applicants: CaseApplicant[],
  customerId: string,
  customers: Customer[],
  links: FamilyMemberLink[] = [],
): Case[] {
  const groupMemberIds = relatedCustomerIds(customerId, customers, links)
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
