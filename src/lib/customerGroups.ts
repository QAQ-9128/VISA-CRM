import { CUSTOMER_TIER_ORDER } from '../types/domain'
import type { Customer } from '../types/models'

export interface FamilyGroup {
  /** 锚定行：主申请人 / 独立客户；孤儿组为 null */
  primary: Customer | null
  /** 该组的副申请人；孤儿组里是找不到主申的副申 */
  subs: Customer[]
  /** 主申不在列表中的孤儿副申组（放末尾） */
  orphan: boolean
}

const tierRank = (c: Customer) => (c.priority_tier ? CUSTOMER_TIER_ORDER[c.priority_tier] : 99)

/** 锚定（主申 / 独立）排序：星标 → 等级 → 姓名。 */
function compareAnchors(a: Customer, b: Customer): number {
  return (
    Number(b.is_starred) - Number(a.is_starred) ||
    tierRank(a) - tierRank(b) ||
    a.full_name.localeCompare(b.full_name)
  )
}

/** 组内副申排序：添加时间 → 姓名。 */
function compareSubs(a: Customer, b: Customer): number {
  return (a.created_at ?? '').localeCompare(b.created_at ?? '') || a.full_name.localeCompare(b.full_name)
}

/**
 * 按家庭组分组 + 排序：每组 = 主申/独立客户(锚定) + 其副申。
 * 副申只出现在自己主申下面；主申不在列表中的副申归入末尾的孤儿组。
 */
export function groupCustomersByFamily(customers: Customer[]): FamilyGroup[] {
  const anchors = customers.filter((c) => !c.primary_applicant_id)
  const subs = customers.filter((c) => c.primary_applicant_id)
  const anchorIds = new Set(anchors.map((a) => a.id))

  const subsByPrimary = new Map<string, Customer[]>()
  const orphans: Customer[] = []
  for (const s of subs) {
    const pid = s.primary_applicant_id as string
    if (anchorIds.has(pid)) {
      const list = subsByPrimary.get(pid) ?? []
      list.push(s)
      subsByPrimary.set(pid, list)
    } else {
      orphans.push(s)
    }
  }

  const groups: FamilyGroup[] = anchors
    .slice()
    .sort(compareAnchors)
    .map((primary) => ({
      primary,
      subs: (subsByPrimary.get(primary.id) ?? []).slice().sort(compareSubs),
      orphan: false,
    }))

  if (orphans.length > 0) {
    groups.push({ primary: null, subs: orphans.slice().sort(compareSubs), orphan: true })
  }
  return groups
}
