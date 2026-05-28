import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  getActiveCases,
  getActiveCustomers,
  getAllPaymentPlans,
  getAllPayments,
  getExpiringCandidateDocuments,
  getPendingLodgements,
  getUnpaidInstallments,
} from '../../api/dashboard'
import {
  computeDebtTotals,
  selectCustomerDebts,
  selectExpiringDocuments,
  selectOverdueInstallments,
  selectUpcomingDecisions,
  sortPriorityCustomers,
} from '../../lib/dashboard'
import { getOpenTasks } from '../../api/tasks'
import { selectMyOpenTasks } from '../../lib/tasks'
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
  const pendingLodgements = useQuery({
    queryKey: queryKeys.dashboard.pendingLodgements,
    queryFn: getPendingLodgements,
  })
  const unpaidInstallments = useQuery({
    queryKey: queryKeys.dashboard.unpaidInstallments,
    queryFn: getUnpaidInstallments,
  })
  const candidateDocuments = useQuery({
    queryKey: queryKeys.dashboard.candidateDocuments,
    queryFn: getExpiringCandidateDocuments,
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

  const all = [
    pendingLodgements,
    unpaidInstallments,
    candidateDocuments,
    activeCases,
    activeCustomers,
    plans,
    payments,
    openTasks,
  ]
  const isPending = all.some((q) => q.isPending)
  const isError = all.some((q) => q.isError)

  const caseById = useMemo(() => keyById(activeCases.data ?? []), [activeCases.data])
  const customerById = useMemo(() => keyById(activeCustomers.data ?? []), [activeCustomers.data])
  const planById = useMemo(() => keyById(plans.data ?? []), [plans.data])

  const upcomingDecisions = useMemo(
    () => selectUpcomingDecisions(pendingLodgements.data ?? [], caseById, customerById),
    [pendingLodgements.data, caseById, customerById],
  )
  const expiringDocuments = useMemo(
    () => selectExpiringDocuments(candidateDocuments.data ?? [], customerById),
    [candidateDocuments.data, customerById],
  )
  const overdueInstallments = useMemo(
    () => selectOverdueInstallments(unpaidInstallments.data ?? [], planById, caseById, customerById),
    [unpaidInstallments.data, planById, caseById, customerById],
  )
  const priorityCustomers = useMemo(
    () => sortPriorityCustomers(activeCustomers.data ?? []),
    [activeCustomers.data],
  )
  const debtTotals = useMemo(
    () => computeDebtTotals(plans.data ?? [], payments.data ?? []),
    [plans.data, payments.data],
  )
  const customerDebts = useMemo(
    () => selectCustomerDebts(plans.data ?? [], payments.data ?? [], caseById, customerById),
    [plans.data, payments.data, caseById, customerById],
  )
  const myOpenTasks = useMemo(
    () => selectMyOpenTasks(openTasks.data ?? [], user?.id),
    [openTasks.data, user?.id],
  )

  return {
    isPending,
    isError,
    upcomingDecisions,
    expiringDocuments,
    overdueInstallments,
    priorityCustomers,
    debtTotals,
    customerDebts,
    myOpenTasks,
  }
}
