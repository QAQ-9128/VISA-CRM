/**
 * 「客户归属人」筛选——案件筛选栏（CasesPage / casesList）与客户筛选栏
 * （CustomerListPage / customersFilter）共用的同一套逻辑：
 * 按客户的归属字段（customers.owner_referrer_id，与介绍人同表 kind=owner）过滤，
 * 选项 = 现有归属值 distinct，选某归属人即筛出其名下案件/客户。
 */

export interface OwnerOption {
  id: string
  name: string
}

/** 选项 = 行里实际出现的归属值 distinct，按名排序；无归属(null)不产出选项。 */
export function ownerFacetOptions(
  rows: Iterable<{ ownerId: string | null; ownerName: string }>,
): OwnerOption[] {
  const owners = new Map<string, string>()
  for (const r of rows) if (r.ownerId) owners.set(r.ownerId, r.ownerName)
  return [...owners].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
}

/** 匹配：空集 = 不限；选中后须有归属且命中（无归属的行/客户被排除）。 */
export function matchesOwnerFilter(selected: ReadonlySet<string>, ownerId: string | null): boolean {
  if (!selected.size) return true
  return ownerId != null && selected.has(ownerId)
}
