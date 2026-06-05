import { displayCustomerName } from './dashboardView'
import { formatVisaType } from './visa'

/**
 * 待办清单展示层助手——纯函数。
 * 归档隐藏：关联的客户 / 案件被归档（不在「在册」集合里）时，该清单项从概览隐藏；
 * 取消归档后又会重新出现（软删语义）。未关联的项不受影响。
 */
export interface ChecklistLink {
  customer_id: string | null
  case_id: string | null
}

// ── 来源标签：每条待办来自哪个客户 / 案件，或「随手记」（不关联）──────────
type SrcCase = { id: string; customer_id: string; visa_subclass: string; visa_stream: string | null }
type SrcCustomer = { id: string; full_name: string | null }

export type ChecklistSource =
  | { kind: 'case'; to: string; label: string } // 客户名 · 签证（→案件）
  | { kind: 'customer'; to: string; label: string } // 客户名（→客户）
  | { kind: 'loose' } // 随手记（不关联）
  | { kind: 'unresolved' } // 关联了但对象不在册/已归档：不显示标签，不编

/** 由真实关联字段 + 在册客户/案件映射派生来源；都为空 = 随手记；接不上 = unresolved（不造假）。 */
export function checklistSource(
  item: ChecklistLink,
  caseById: Record<string, SrcCase>,
  customerById: Record<string, SrcCustomer>,
): ChecklistSource {
  if (item.case_id) {
    const c = caseById[item.case_id]
    if (!c) return { kind: 'unresolved' }
    const cust = customerById[c.customer_id]
    return {
      kind: 'case',
      // 案件详情路由已删（案件并入客户详情页）：链到客户页并带 case 参数定位该案件
      to: `/customers/${c.customer_id}?case=${c.id}`,
      label: `${displayCustomerName(cust?.full_name, '客户')} · ${formatVisaType(c.visa_subclass, c.visa_stream)}`,
    }
  }
  if (item.customer_id) {
    const cust = customerById[item.customer_id]
    if (!cust) return { kind: 'unresolved' }
    return { kind: 'customer', to: `/customers/${cust.id}`, label: displayCustomerName(cust.full_name) }
  }
  return { kind: 'loose' }
}

/** 关联的客户或案件已归档/不存在则过滤掉；无关联或关联在册则保留。 */
export function selectVisibleChecklist<T extends ChecklistLink>(
  items: T[],
  activeCustomerIds: ReadonlySet<string>,
  activeCaseIds: ReadonlySet<string>,
): T[] {
  return items.filter((it) => {
    if (it.customer_id && !activeCustomerIds.has(it.customer_id)) return false
    if (it.case_id && !activeCaseIds.has(it.case_id)) return false
    return true
  })
}
