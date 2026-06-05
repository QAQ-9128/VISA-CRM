import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  getActiveCases,
  getActiveCustomers,
  getAllPaymentPlans,
  getAllPayments,
} from '../../api/dashboard'
import { getAllPlanItems, getAllInstallments } from '../../api/payments'
import { listReferrers } from '../../api/referrers'
import { listAllCaseApplicants } from '../../api/caseApplicants'
import {
  filterPaymentsByMonth,
  selectFinancePayouts,
  selectFinanceReceipts,
  selectFinanceReceivables,
  selectRecentCases,
  sumFinanceReceivables,
} from '../../lib/finance'
import { installmentSummaryByPlan } from '../../lib/financeRows'
import { visibleCaseIds } from '../../lib/visibility'
import { formatVisaType } from '../../lib/visa'
import { shiftMonth } from '../../lib/month'
import { queryKeys } from './keys'

function keyById<T extends { id: string }>(rows: T[]): Record<string, T> {
  const map: Record<string, T> = {}
  for (const r of rows) map[r.id] = r
  return map
}

/**
 * 财务总览数据。month='YYYY-MM' 时，收款明细/支出明细按该月 paid_at 过滤、合计随之；
 * month=null 表示「全部」。应收汇总（余额）始终按所有时间累计，不受 month 影响。
 */
export function useFinance(month: string | null) {
  const cases = useQuery({ queryKey: queryKeys.dashboard.activeCases, queryFn: getActiveCases })
  const customers = useQuery({
    queryKey: queryKeys.dashboard.activeCustomers,
    queryFn: getActiveCustomers,
  })
  const plans = useQuery({ queryKey: queryKeys.dashboard.plans, queryFn: getAllPaymentPlans })
  const payments = useQuery({ queryKey: queryKeys.dashboard.payments, queryFn: getAllPayments })
  const planItems = useQuery({ queryKey: queryKeys.dashboard.planItems, queryFn: getAllPlanItems })
  const installments = useQuery({ queryKey: queryKeys.finance.installments, queryFn: getAllInstallments })
  // 含归档：付给已归档介绍人的款仍需显示其名字
  const referrers = useQuery({
    queryKey: queryKeys.finance.referrers,
    queryFn: () => listReferrers({ includeArchived: true }),
  })
  const caseApplicants = useQuery({
    queryKey: queryKeys.caseApplicants.all,
    queryFn: listAllCaseApplicants,
  })

  const all = [cases, customers, plans, payments, planItems, referrers, caseApplicants, installments]
  const isPending = all.some((q) => q.isPending)
  const isError = all.some((q) => q.isError)

  const today = useMemo(() => new Date(), [])
  const caseById = useMemo(() => keyById(cases.data ?? []), [cases.data])
  const planById = useMemo(() => keyById(plans.data ?? []), [plans.data])
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
        planItems.data ?? [],
      ),
    [visibleCases, caseApplicants.data, plans.data, visiblePayments, customerById, planItems.data],
  )
  const receivableTotals = useMemo(() => sumFinanceReceivables(receivables), [receivables])

  // 收款/支出明细按选定月份过滤（应收余额不过滤）
  const monthPayments = useMemo(
    () => filterPaymentsByMonth(visiblePayments, month),
    [visiblePayments, month],
  )
  const receipts = useMemo(
    () => selectFinanceReceipts(monthPayments, caseById, customerById),
    [monthPayments, caseById, customerById],
  )
  const payouts = useMemo(
    () => selectFinancePayouts(monthPayments, caseById, customerById, referrerById),
    [monthPayments, caseById, customerById, referrerById],
  )

  // 上月（month−1）收/支：月度账目 KPI「较上月」用。复用同一套过滤 + selector，零新查询。
  const prevMonthPayments = useMemo(
    () => (month ? filterPaymentsByMonth(visiblePayments, shiftMonth(month, -1)) : []),
    [visiblePayments, month],
  )
  const prevReceipts = useMemo(
    () => selectFinanceReceipts(prevMonthPayments, caseById, customerById),
    [prevMonthPayments, caseById, customerById],
  )
  const prevPayouts = useMemo(
    () => selectFinancePayouts(prevMonthPayments, caseById, customerById, referrerById),
    [prevMonthPayments, caseById, customerById, referrerById],
  )

  // 加支出/加收款表单用：可选案件下拉（客户·签证），同样只列在册客户的案件
  const caseOptions = useMemo(
    () =>
      visibleCases
        .map((c) => ({
          caseId: c.id,
          customerId: c.customer_id,
          label: `${customerById[c.customer_id]?.full_name ?? '未知客户'} · ${formatVisaType(c.visa_subclass, c.visa_stream)}`,
          referrerId: customerById[c.customer_id]?.referrer_id ?? null,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [visibleCases, customerById],
  )

  // 近期案件（区域 1）：按 updated_at 倒序的前 5 个案件 id（顺序保留）
  const recentCaseIds = useMemo(() => selectRecentCases(visibleCases, 5).map((c) => c.id), [visibleCases])

  // 分期进度 / 下一期：只取在册案件的计划的分期，按计划归集
  const instByPlan = useMemo(() => {
    const visibleInst = (installments.data ?? []).filter((i) => {
      const plan = planById[i.payment_plan_id]
      return plan ? visibleIds.has(plan.case_id) : false
    })
    return installmentSummaryByPlan(visibleInst, today)
  }, [installments.data, planById, visibleIds, today])
  // 富表搜索/导出用：案件 id → 案件号
  const caseNumberByCaseId = useMemo(() => {
    const m: Record<string, string> = {}
    for (const c of visibleCases) m[c.id] = c.case_number
    return m
  }, [visibleCases])
  // 月度账目支出行 tag 用：案件 id → 签证类别（收入行自带 visaSubclass，支出行靠它补齐）
  const visaByCaseId = useMemo(() => {
    const m: Record<string, string> = {}
    for (const c of visibleCases) m[c.id] = c.visa_subclass
    return m
  }, [visibleCases])

  return {
    isPending,
    isError,
    receivables,
    receivableTotals,
    recentCaseIds,
    receipts,
    payouts,
    prevReceipts,
    prevPayouts,
    caseOptions,
    referrerById,
    instByPlan,
    caseNumberByCaseId,
    visaByCaseId,
  }
}
