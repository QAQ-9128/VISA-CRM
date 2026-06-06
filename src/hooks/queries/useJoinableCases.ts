import { useMemo } from 'react'
import { useCustomers } from './useCustomers'
import { useCases } from './useCases'
import { useAllCaseApplicants } from './useCaseApplicants'
import { visibleCaseIds } from '../../lib/visibility'
import type { Customer } from '../../types/models'

/**
 * 「加入已有案件」的可选案件集合（完整表单与快速建档卡共用同一口径）：
 * 未归档案件 ∩ 至少有一名在册参与人（全员归档的案件不再可加入）。
 */
export function useJoinableCases() {
  const allCustomers = useCustomers({})
  const allCases = useCases()
  const allApplicants = useAllCaseApplicants()

  const customerById = useMemo(
    () => Object.fromEntries((allCustomers.data ?? []).map((c) => [c.id, c])) as Record<string, Customer | undefined>,
    [allCustomers.data],
  )
  const joinableCases = useMemo(() => {
    const active = (allCases.data ?? []).filter((c) => !c.is_archived)
    const visible = visibleCaseIds(active, customerById, allApplicants.data ?? [])
    return active.filter((c) => visible.has(c.id))
  }, [allCases.data, customerById, allApplicants.data])

  return { joinableCases, applicants: allApplicants.data ?? [], customerById }
}
