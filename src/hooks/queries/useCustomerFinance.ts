import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getActiveCustomers, getAllPaymentPlans, getAllPayments } from '../../api/dashboard'
import { getAllPlanItems } from '../../api/payments'
import { listReferrers } from '../../api/referrers'
import { listAllCaseApplicants } from '../../api/caseApplicants'
import { listCasesByCustomer } from '../../api/cases'
import { getCustomer } from '../../api/customers'
import { selectCustomerFinance } from '../../lib/finance'
import { formatVisaType } from '../../lib/visa'
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
  const planItems = useQuery({ queryKey: queryKeys.dashboard.planItems, queryFn: getAllPlanItems })
  const referrers = useQuery({
    queryKey: queryKeys.finance.referrers,
    queryFn: () => listReferrers({ includeArchived: true }),
  })
  const caseApplicants = useQuery({
    queryKey: queryKeys.caseApplicants.all,
    queryFn: listAllCaseApplicants,
  })
  // 全部在册客户：用于把合并账单行里的副申请人名字查出来（共享 /finance 的缓存键）
  const allCustomers = useQuery({
    queryKey: queryKeys.dashboard.activeCustomers,
    queryFn: getActiveCustomers,
  })

  const all = [cases, customer, plans, payments, planItems, referrers, caseApplicants, allCustomers]
  const isPending = all.some((q) => q.isPending)
  const isError = all.some((q) => q.isError)

  // 含全部在册客户（解析副申名字）+ 保底放入当前客户（即便其已归档）
  const customerById = useMemo(() => {
    const map = keyById(allCustomers.data ?? [])
    if (customer.data) map[customer.data.id] = customer.data
    return map
  }, [allCustomers.data, customer.data])
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
        planItems.data ?? [],
      ),
    [customerId, cases.data, caseApplicants.data, plans.data, payments.data, customerById, referrerById, planItems.data],
  )

  const caseOptions = useMemo(
    () =>
      (cases.data ?? []).map((c) => ({
        caseId: c.id,
        customerId: c.customer_id,
        label: `${customer.data?.full_name ?? '客户'} · ${formatVisaType(c.visa_subclass, c.visa_stream)}`,
        referrerId: customer.data?.referrer_id ?? null,
      })),
    [cases.data, customer.data],
  )

  return { isPending, isError, ...finance, caseOptions, referrerById }
}
