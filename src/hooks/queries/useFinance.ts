import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  getActiveCases,
  getActiveCustomers,
  getAllPaymentPlans,
  getAllPayments,
} from '../../api/dashboard'
import { listReferrers } from '../../api/referrers'
import { listAllCaseApplicants } from '../../api/caseApplicants'
import {
  selectFinancePayouts,
  selectFinanceReceipts,
  selectFinanceReceivables,
  sumFinanceReceivables,
} from '../../lib/finance'
import { visibleCaseIds } from '../../lib/visibility'
import { queryKeys } from './keys'

function keyById<T extends { id: string }>(rows: T[]): Record<string, T> {
  const map: Record<string, T> = {}
  for (const r of rows) map[r.id] = r
  return map
}

/** 财务总览所需数据：应收汇总（按客户）+ 支出明细（付主代理 / 付介绍人）。 */
export function useFinance() {
  const cases = useQuery({ queryKey: queryKeys.dashboard.activeCases, queryFn: getActiveCases })
  const customers = useQuery({
    queryKey: queryKeys.dashboard.activeCustomers,
    queryFn: getActiveCustomers,
  })
  const plans = useQuery({ queryKey: queryKeys.dashboard.plans, queryFn: getAllPaymentPlans })
  const payments = useQuery({ queryKey: queryKeys.dashboard.payments, queryFn: getAllPayments })
  // 含归档：付给已归档介绍人的款仍需显示其名字
  const referrers = useQuery({
    queryKey: queryKeys.finance.referrers,
    queryFn: () => listReferrers({ includeArchived: true }),
  })
  const caseApplicants = useQuery({
    queryKey: queryKeys.caseApplicants.all,
    queryFn: listAllCaseApplicants,
  })

  const all = [cases, customers, plans, payments, referrers, caseApplicants]
  const isPending = all.some((q) => q.isPending)
  const isError = all.some((q) => q.isError)

  const caseById = useMemo(() => keyById(cases.data ?? []), [cases.data])
  const customerById = useMemo(() => keyById(customers.data ?? []), [customers.data])
  const referrerById = useMemo(() => keyById(referrers.data ?? []), [referrers.data])

  // 归档客户的案件从财务隐藏：只保留主申在册的案件
  const visibleIds = useMemo(() => visibleCaseIds(cases.data ?? [], customerById), [cases.data, customerById])
  const visibleCases = useMemo(
    () => (cases.data ?? []).filter((c) => visibleIds.has(c.id)),
    [cases.data, visibleIds],
  )
  const visiblePayments = useMemo(
    () => (payments.data ?? []).filter((p) => visibleIds.has(p.case_id)),
    [payments.data, visibleIds],
  )

  const receivables = useMemo(
    () =>
      selectFinanceReceivables(
        visibleCases,
        caseApplicants.data ?? [],
        plans.data ?? [],
        visiblePayments,
        customerById,
      ),
    [visibleCases, caseApplicants.data, plans.data, visiblePayments, customerById],
  )
  const receivableTotals = useMemo(() => sumFinanceReceivables(receivables), [receivables])
  const receipts = useMemo(
    () => selectFinanceReceipts(visiblePayments, caseById, customerById),
    [visiblePayments, caseById, customerById],
  )
  const payouts = useMemo(
    () => selectFinancePayouts(visiblePayments, caseById, customerById, referrerById),
    [visiblePayments, caseById, customerById, referrerById],
  )

  // 加支出/加收款表单用：可选案件下拉（客户·签证），同样只列在册客户的案件
  const caseOptions = useMemo(
    () =>
      visibleCases
        .map((c) => ({
          caseId: c.id,
          customerId: c.customer_id,
          label: `${customerById[c.customer_id]?.full_name ?? '未知客户'} · ${c.visa_subclass}`,
          referrerId: customerById[c.customer_id]?.referrer_id ?? null,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [visibleCases, customerById],
  )

  return { isPending, isError, receivables, receivableTotals, receipts, payouts, caseOptions, referrerById }
}
