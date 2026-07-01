import type { CustomerFamilyMember } from '../types/models'

/**
 * 客户级 family（家庭成员）纯逻辑：关系预设 + 按客户过滤。
 * family 是纯关系信息（名字+关系+可选关联档案），**不进账目、不建档**。
 */

/** 关系预设（可手填任意值；照 mockup）。ComboBox 建议项。 */
export const FAMILY_RELATIONS = ['配偶', '子女', '父母', '兄弟姐妹', '其他'] as const

/** 取某客户的 family 成员（前端从全量过滤；created_at 升序＝录入序）。 */
export function selectFamilyByCustomer(
  all: CustomerFamilyMember[],
  customerId: string | null | undefined,
): CustomerFamilyMember[] {
  if (!customerId) return []
  return all
    .filter((m) => m.customer_id === customerId)
    .slice()
    .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? '') || a.id.localeCompare(b.id))
}
