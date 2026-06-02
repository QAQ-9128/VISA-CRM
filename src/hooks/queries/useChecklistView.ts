import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getActiveCases, getActiveCustomers } from '../../api/dashboard'
import { useChecklist } from './useChecklist'
import { selectVisibleChecklist } from '../../lib/checklist'
import { queryKeys } from './keys'
import type { Case, Customer } from '../../types/models'

/**
 * 概览待办清单视图：清单项 + 在册客户/案件映射，并按归档隐藏过滤。
 * 复用 dashboard 的 activeCases/activeCustomers 查询键（共享缓存，无额外请求）。
 * 概览统计与清单卡共用本 hook，保证「待办」计数一致。
 */
export function useChecklistView() {
  const list = useChecklist()
  const cases = useQuery({ queryKey: queryKeys.dashboard.activeCases, queryFn: getActiveCases })
  const customers = useQuery({ queryKey: queryKeys.dashboard.activeCustomers, queryFn: getActiveCustomers })

  const activeCaseIds = useMemo(() => new Set((cases.data ?? []).map((c) => c.id)), [cases.data])
  const activeCustomerIds = useMemo(() => new Set((customers.data ?? []).map((c) => c.id)), [customers.data])
  const caseById = useMemo<Record<string, Case>>(
    () => Object.fromEntries((cases.data ?? []).map((c) => [c.id, c])),
    [cases.data],
  )
  const customerById = useMemo<Record<string, Customer>>(
    () => Object.fromEntries((customers.data ?? []).map((c) => [c.id, c])),
    [customers.data],
  )

  const items = useMemo(
    () => selectVisibleChecklist(list.data ?? [], activeCustomerIds, activeCaseIds),
    [list.data, activeCustomerIds, activeCaseIds],
  )
  const openCount = items.filter((i) => !i.is_done).length

  return {
    items,
    openCount,
    isPending: list.isPending,
    cases: cases.data ?? [],
    customers: customers.data ?? [],
    caseById,
    customerById,
  }
}
