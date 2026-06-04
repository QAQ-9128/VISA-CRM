import { CLIENT_SOURCES } from '../types/domain'
import type { ClientSource } from '../types/domain'
import type { Customer } from '../types/models'

export interface SourceColumn {
  /** null = 未分类（client_source 为空或历史未知值） */
  source: ClientSource | null
  customers: Customer[]
}

/**
 * 客户来源看板（纯派生）：固定三列 黑(公司派 'red')/绿(自己)/黄(擦屁股)，
 * 有未分类客户时追加灰色「未分类」列兜底（不丢人）。列内星标在前、其余保持传入顺序。
 */
export function selectSourceBoardColumns(customers: Customer[]): SourceColumn[] {
  const bySource = new Map<string, Customer[]>()
  for (const c of customers) {
    const key =
      c.client_source && (CLIENT_SOURCES as readonly string[]).includes(c.client_source)
        ? c.client_source
        : 'none'
    const list = bySource.get(key) ?? []
    list.push(c)
    bySource.set(key, list)
  }
  const starFirst = (list: Customer[]) =>
    [...list].sort((a, b) => Number(b.is_starred) - Number(a.is_starred))

  const cols: SourceColumn[] = CLIENT_SOURCES.map((s) => ({
    source: s,
    customers: starFirst(bySource.get(s) ?? []),
  }))
  const none = bySource.get('none') ?? []
  if (none.length > 0) cols.push({ source: null, customers: starFirst(none) })
  return cols
}
