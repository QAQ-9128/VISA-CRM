import type { Customer, FamilyMemberLink } from '../types/models'

/** 家庭组里的一个副申：原生副申(primary_applicant_id) 或 关联进来的已有客户(family_member_links)。 */
export interface FamilyGroupSub {
  customer: Customer
  /** true = 通过关联表挂进来的「已有独立档案」客户（顶层仍有自己的组/case）；false = 原生副申 */
  linked: boolean
  relationship: string | null
}

export interface FamilyGroup {
  /** 锚定行：主申请人 / 独立客户；孤儿组为 null */
  primary: Customer | null
  /** 该组的副申请人（原生 + 关联）；孤儿组里是找不到主申的原生副申 */
  subs: FamilyGroupSub[]
  /** 主申不在列表中的孤儿副申组（放末尾） */
  orphan: boolean
}

/** 锚定（主申 / 独立）排序：星标 → 姓名。 */
function compareAnchors(a: Customer, b: Customer): number {
  return Number(b.is_starred) - Number(a.is_starred) || a.full_name.localeCompare(b.full_name)
}

/** 组内副申排序：添加时间 → 姓名。 */
function compareSubs(a: FamilyGroupSub, b: FamilyGroupSub): number {
  return (
    (a.customer.created_at ?? '').localeCompare(b.customer.created_at ?? '') ||
    a.customer.full_name.localeCompare(b.customer.full_name)
  )
}

/**
 * 按家庭组分组 + 排序：每组 = 主申/独立客户(锚定) + 其副申（原生 primary_applicant_id + 关联 links）。
 * 关联进来的客户因 primary_applicant_id 仍为空，照样作为顶层锚定出现，同时作为 sub 挂在主申下（两处显示）。
 * 原生副申只出现在自己主申下；主申不在列表中的原生副申归入末尾孤儿组。links 缺省 = 现状行为。
 */
export function groupCustomersByFamily(
  customers: Customer[],
  links: FamilyMemberLink[] = [],
): FamilyGroup[] {
  const anchors = customers.filter((c) => !c.primary_applicant_id)
  const anchorIds = new Set(anchors.map((a) => a.id))
  const byId = new Map(customers.map((c) => [c.id, c]))

  // 原生副申：归到各自主申下；主申不在列表 → 孤儿
  const nativeByPrimary = new Map<string, FamilyGroupSub[]>()
  const orphans: FamilyGroupSub[] = []
  for (const c of customers) {
    if (!c.primary_applicant_id) continue
    const sub: FamilyGroupSub = { customer: c, linked: false, relationship: c.relationship_to_primary }
    if (anchorIds.has(c.primary_applicant_id)) {
      const list = nativeByPrimary.get(c.primary_applicant_id) ?? []
      list.push(sub)
      nativeByPrimary.set(c.primary_applicant_id, list)
    } else {
      orphans.push(sub)
    }
  }

  // 关联成员：挂到 anchor 主申下（member 须在列表里才显示）
  const linkedByPrimary = new Map<string, FamilyGroupSub[]>()
  for (const lk of links) {
    if (!anchorIds.has(lk.primary_customer_id)) continue
    const member = byId.get(lk.member_customer_id)
    if (!member) continue
    const list = linkedByPrimary.get(lk.primary_customer_id) ?? []
    list.push({ customer: member, linked: true, relationship: lk.relationship })
    linkedByPrimary.set(lk.primary_customer_id, list)
  }

  const groups: FamilyGroup[] = anchors
    .slice()
    .sort(compareAnchors)
    .map((primary) => {
      const native = nativeByPrimary.get(primary.id) ?? []
      const seen = new Set(native.map((s) => s.customer.id))
      // 已是原生副申的客户不再重复加关联行
      const linked = (linkedByPrimary.get(primary.id) ?? []).filter((s) => !seen.has(s.customer.id))
      const subs = [...native, ...linked].sort(compareSubs)
      return { primary, subs, orphan: false }
    })

  if (orphans.length > 0) {
    groups.push({ primary: null, subs: orphans.slice().sort(compareSubs), orphan: true })
  }
  return groups
}
