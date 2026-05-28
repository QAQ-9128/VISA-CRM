import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAllPaymentPlans, getAllPayments } from '../../api/dashboard'
import { listReferrers } from '../../api/referrers'
import { listAllCaseApplicants } from '../../api/caseApplicants'
import { listCasesByCustomer } from '../../api/cases'
import { getCustomer } from '../../api/customers'
import { selectCustomerFinance } from '../../lib/finance'
import { queryKeys } from './keys'
import type { Referrer } from '../../types/models'

function keyById<T extends { id: string }>(rows: T[]): Record<string, T> {
  const map: Record<string, T> = {}
  for (const r of rows) map[r.id] = r
  return map
}

/**
 * 单个客户的财务（客户详情页用）。
 * plans/payments/referrers 复用 dashboard/finance 查询键 → 与 /finance 共享缓存，
 * 任一处录入/编辑/删除付款都会让两边同时失效刷新（见 usePayments 的失效逻辑）。
 */
export function useCustomerFinance(customerId: string | undefined) {
  const cases = useQuery({
    queryKey: queryKeys.cases.byCustomer(customerId ?? ''),
    queryFn: () => listCasesByCustomer(customerId as string),
    enabled: !!customerId,
  })
  const customer = useQuery({
    queryKey: queryKeys.customers.detail(customerId ?? ''),
    queryFn: () => getCustomer(customerId as string),
    enabled: !!customerId,
  })
  const plans = useQuery({ queryKey: queryKeys.dashboard.plans, queryFn: getAllPaymentPlans })
  const payments = useQuery({ queryKey: queryKeys.dashboard.payments, queryFn: getAllPayments })
  const referrers = useQuery({
    queryKey: queryKeys.finance.referrers,
    queryFn: () => listReferrers({ includeArchived: true }),
  })
  const caseApplicants = useQuery({
    queryKey: queryKeys.caseApplicants.all,
    queryFn: listAllCaseApplicants,
  })

  const all = [cases, customer, plans, payments, referrers, caseApplicants]
  const isPending = all.some((q) => q.isPending)
  const isError = all.some((q) => q.isError)

  const customerById = useMemo(
    () => (customer.data ? { [customer.data.id]: customer.data } : {}),
    [customer.data],
  )
  const referrerById = useMemo<Record<string, Referrer>>(
    () => keyById(referrers.data ?? []),
    [referrers.data],
  )

  const finance = useMemo(
    () =>
      selectCustomerFinance(
        customerId ?? '',
        cases.data ?? [],
        caseApplicants.data ?? [],
        plans.data ?? [],
        payments.data ?? [],
        customerById,
        referrerById,
      ),
    [customerId, cases.data, caseApplicants.data, plans.data, payments.data, customerById, referrerById],
  )

  const caseOptions = useMemo(
    () =>
      (cases.data ?? []).map((c) => ({
        caseId: c.id,
        customerId: c.customer_id,
        label: `${customer.data?.full_name ?? '客户'} · ${c.visa_subclass}`,
        referrerId: customer.data?.referrer_id ?? null,
      })),
    [cases.data, customer.data],
  )

  return { isPending, isError, ...finance, caseOptions, referrerById }
}
