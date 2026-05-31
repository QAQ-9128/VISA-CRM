import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getActiveCases, getAllPaymentPlans, getAllPayments } from '../../api/dashboard'
import { getAllPlanItems } from '../../api/payments'
import { selectCustomerDebts, selectCustomerDebtSummary } from '../../lib/dashboard'
import type { CustomerPaymentColor } from '../../lib/finance'
import type { Case } from '../../types/models'
import { queryKeys } from './keys'

function caseMap(cases: Case[]): Record<string, Case> {
  const m: Record<string, Case> = {}
  for (const c of cases) m[c.id] = c
  return m
}

/**
 * 按「实际付款方(billed_to)」归集的欠款聚合，供客户详情页「归集欠款」与客户列表付款颜色共用。
 * 复用 dashboard 的全局查询键（缓存共享），返回：
 *   summaryOf(customerId)   该客户名下归集欠款汇总（含他被 billed_to 指向的别人案件）
 *   colorByCustomerId       客户 id → 付款颜色（按聚合后欠款判断）
 */
export function useCustomerDebts() {
  const cases = useQuery({ queryKey: queryKeys.dashboard.activeCases, queryFn: getActiveCases })
  const plans = useQuery({ queryKey: queryKeys.dashboard.plans, queryFn: getAllPaymentPlans })
  const payments = useQuery({ queryKey: queryKeys.dashboard.payments, queryFn: getAllPayments })
  const planItems = useQuery({ queryKey: queryKeys.dashboard.planItems, queryFn: getAllPlanItems })

  const caseById = useMemo(() => caseMap(cases.data ?? []), [cases.data])

  const colorByCustomerId = useMemo(() => {
    // selectCustomerDebts 需要 customerById 仅用于名字；颜色不依赖名字，传空对象即可
    const debts = selectCustomerDebts(plans.data ?? [], payments.data ?? [], caseById, {}, planItems.data ?? [])
    const m: Record<string, CustomerPaymentColor> = {}
    for (const d of debts) m[d.customerId] = d.color
    return m
  }, [plans.data, payments.data, caseById, planItems.data])

  const summaryOf = (customerId: string) =>
    selectCustomerDebtSummary(customerId, plans.data ?? [], payments.data ?? [], caseById, planItems.data ?? [])

  return {
    isPending: cases.isPending || plans.isPending || payments.isPending || planItems.isPending,
    summaryOf,
    colorByCustomerId,
  }
}
