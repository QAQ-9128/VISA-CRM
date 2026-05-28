import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  getActiveCases,
  getActiveCustomers,
  getAllPaymentPlans,
  getAllPayments,
  getUnpaidInstallments,
} from '../../api/dashboard'
import {
  computeDebtTotals,
  selectCustomerDebts,
  selectCustomersWithOpenTasks,
  selectOverdueInstallments,
  sortPriorityCustomers,
} from '../../lib/dashboard'
import { getOpenTasks } from '../../api/tasks'
import { selectMyOpenTasks } from '../../lib/tasks'
import { visibleCaseIds } from '../../lib/visibility'
import { useAuth } from '../useAuth'
import { queryKeys } from './keys'

function keyById<T extends { id: string }>(rows: T[]): Record<string, T> {
  const map: Record<string, T> = {}
  for (const r of rows) map[r.id] = r
  return map
}

/** 概览首页所需的全部预警，由若干查询组合 + 纯选择器派生。 */
export function useDashboard() {
  const { user } = useAuth()
  const unpaidInstallments = useQuery({
    queryKey: queryKeys.dashboard.unpaidInstallments,
    queryFn: getUnpaidInstallments,
  })
  const activeCases = useQuery({
    queryKey: queryKeys.dashboard.activeCases,
    queryFn: getActiveCases,
  })
  const activeCustomers = useQuery({
    queryKey: queryKeys.dashboard.activeCustomers,
    queryFn: getActiveCustomers,
  })
  const plans = useQuery({ queryKey: queryKeys.dashboard.plans, queryFn: getAllPaymentPlans })
  const payments = useQuery({ queryKey: queryKeys.dashboard.payments, queryFn: getAllPayments })
  const openTasks = useQuery({ queryKey: queryKeys.tasks.open, queryFn: getOpenTasks })

  const all = [unpaidInstallments, activeCases, activeCustomers, plans, payments, openTasks]
  const isPending = all.some((q) => q.isPending)
  const isError = all.some((q) => q.isError)

  const caseById = useMemo(() => keyById(activeCases.data ?? []), [activeCases.data])
  const customerById = useMemo(() => keyById(activeCustomers.data ?? []), [activeCustomers.data])
  const planById = useMemo(() => keyById(plans.data ?? []), [plans.data])

  // 归档客户的案件从各卡片隐藏：只保留主申在册的案件
  const visibleIds = useMemo(
    () => visibleCaseIds(activeCases.data ?? [], customerById),
    [activeCases.data, customerById],
  )
  const visiblePlans = useMemo(
    () => (plans.data ?? []).filter((p) => visibleIds.has(p.case_id)),
    [plans.data, visibleIds],
  )
  const visibleUnpaid = useMemo(
    () =>
      (unpaidInstallments.data ?? []).filter((i) => {
        const plan = planById[i.payment_plan_id]
        return plan ? visibleIds.has(plan.case_id) : false
      }),
    [unpaidInstallments.data, planById, visibleIds],
  )

  const overdueInstallments = useMemo(
    () => selectOverdueInstallments(visibleUnpaid, planById, caseById, customerById),
    [visibleUnpaid, planById, caseById, customerById],
  )
  const priorityCustomers = useMemo(
    () => sortPriorityCustomers(activeCustomers.data ?? []),
    [activeCustomers.data],
  )
  const debtTotals = useMemo(
    () => computeDebtTotals(visiblePlans, payments.data ?? []),
    [visiblePlans, payments.data],
  )
  const customerDebts = useMemo(
    () => selectCustomerDebts(visiblePlans, payments.data ?? [], caseById, customerById),
    [visiblePlans, payments.data, caseById, customerById],
  )
  const myOpenTasks = useMemo(
    () => selectMyOpenTasks(openTasks.data ?? [], user?.id, undefined, undefined, customerById),
    [openTasks.data, user?.id, customerById],
  )
  const customersWithOpenTasks = useMemo(
    () => selectCustomersWithOpenTasks(openTasks.data ?? [], customerById),
    [openTasks.data, customerById],
  )

  return {
    isPending,
    isError,
    overdueInstallments,
    priorityCustomers,
    debtTotals,
    customerDebts,
    myOpenTasks,
    customersWithOpenTasks,
    // 供「我的待办」按 customer_id 显示并链接客户名
    customerById,
  }
}
