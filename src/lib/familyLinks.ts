import type { Customer, FamilyMemberLink } from '../types/models'

/**
 * 家庭成员关联的派生选择器（纯函数）。关联只影响"显示/家庭关系"，
 * 不进入计费/案件副申候选/sync——这些逻辑都不接 links 参数。
 */

type CustomerMap = Record<string, Customer | undefined>

export interface LinkedMember {
  linkId: string
  customer: Customer
  relationship: string | null
}

/** 某主申 A 名下「关联进来的」成员（family_member_links 里 primary=A 的，member 解析为客户）。 */
export function selectLinkedMembers(primaryId: string, links: FamilyMemberLink[], customerById: CustomerMap): LinkedMember[] {
  const out: LinkedMember[] = []
  for (const lk of links) {
    if (lk.primary_customer_id !== primaryId) continue
    const customer = customerById[lk.member_customer_id]
    if (!customer) continue
    out.push({ linkId: lk.id, customer, relationship: lk.relationship })
  }
  return out
}

export interface LinkedInto {
  linkId: string
  primary: Customer
  relationship: string | null
}

/** 反向：客户 B 被关联进了哪些家庭组（管理/解除用）。 */
export function selectLinkedInto(memberId: string, links: FamilyMemberLink[], customerById: CustomerMap): LinkedInto[] {
  const out: LinkedInto[] = []
  for (const lk of links) {
    if (lk.member_customer_id !== memberId) continue
    const primary = customerById[lk.primary_customer_id]
    if (!primary) continue
    out.push({ linkId: lk.id, primary, relationship: lk.relationship })
  }
  return out
}

/** 「关联现有客户」候选：排除本人、A 现有原生副申、已关联成员、归档客户。 */
export function selectLinkCandidates(primaryId: string, customers: Customer[], links: FamilyMemberLink[]): Customer[] {
  const linkedMemberIds = new Set(links.filter((l) => l.primary_customer_id === primaryId).map((l) => l.member_customer_id))
  return customers.filter(
    (c) =>
      c.id !== primaryId &&
      !c.is_archived &&
      c.primary_applicant_id !== primaryId && // A 的原生副申不必再关联
      !linkedMemberIds.has(c.id),
  )
}
