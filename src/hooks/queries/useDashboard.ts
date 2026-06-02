import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  getActiveCases,
  getActiveCustomers,
  getAllPaymentPlans,
  getAllPayments,
  getExpiringDocuments,
  getUnpaidInstallments,
} from '../../api/dashboard'
import { getAllPlanItems } from '../../api/payments'
import { listAllLodgements } from '../../api/lodgements'
import {
  caseStageDistribution,
  computeDebtTotals,
  countActiveCases,
  monthlyClientReceipts,
  monthOverMonth,
  selectCustomerDebts,
  selectExpiringDocs,
  selectLodgementProgressRows,
  selectOverdueInstallments,
  selectTodoCases,
  sortPriorityCustomers,
  sumClientReceiptsInMonth,
} from '../../lib/dashboard'
import { getOpenTaskRecords } from '../../api/records'
import { listAllStageHistory } from '../../api/cases'
import { selectMyOpenTasks } from '../../lib/tasks'
import { selectTrtReminders } from '../../lib/trt'
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
  const planItems = useQuery({ queryKey: queryKeys.dashboard.planItems, queryFn: getAllPlanItems })
  const openTasks = useQuery({ queryKey: queryKeys.records.openTasks, queryFn: getOpenTaskRecords })
  const stageHistory = useQuery({ queryKey: queryKeys.cases.stageHistoryAll, queryFn: listAllStageHistory })
  const lodgements = useQuery({ queryKey: queryKeys.lodgements.lodged, queryFn: listAllLodgements })
  const expiringDocs = useQuery({ queryKey: queryKeys.dashboard.expiringDocs, queryFn: getExpiringDocuments })

  const all = [unpaidInstallments, activeCases, activeCustomers, plans, payments, planItems, openTasks, stageHistory, lodgements, expiringDocs]
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
    () => computeDebtTotals(visiblePlans, payments.data ?? [], planItems.data ?? []),
    [visiblePlans, payments.data, planItems.data],
  )
  const customerDebts = useMemo(
    () => selectCustomerDebts(visiblePlans, payments.data ?? [], caseById, customerById, planItems.data ?? []),
    [visiblePlans, payments.data, caseById, customerById, planItems.data],
  )
  const myOpenTasks = useMemo(
    () => selectMyOpenTasks(openTasks.data ?? [], user?.id, customerById),
    [openTasks.data, user?.id, customerById],
  )
  // 待办案件：current_stage='todo' 且未归档，按 created_at 倒序
  const todoCases = useMemo(
    () => selectTodoCases(activeCases.data ?? [], customerById),
    [activeCases.data, customerById],
  )
  // 转 186 TRT 提醒：只看在册客户的案件（用 customerById 过滤已在上游 activeCustomers 保证）
  const trtReminders = useMemo(
    () => selectTrtReminders(activeCases.data ?? [], stageHistory.data ?? [], customerById),
    [activeCases.data, stageHistory.data, customerById],
  )

  // ── 概览统计卡（全真实数据）─────────────────────────────
  const activeCaseCount = useMemo(() => countActiveCases(activeCases.data ?? []), [activeCases.data])
  const activeCustomerCount = (activeCustomers.data ?? []).length
  const stageDistribution = useMemo(
    () => caseStageDistribution(activeCases.data ?? []),
    [activeCases.data],
  )
  // 本月收款 + 月环比 + 近 6 月序列（按 paid_at 落月，from_client 方向）
  const { thisMonthReceipts, receiptsMoM, revenueSeries } = useMemo(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    const prevY = m === 0 ? y - 1 : y
    const prevM = m === 0 ? 11 : m - 1
    const list = payments.data ?? []
    const cur = sumClientReceiptsInMonth(list, y, m)
    const prev = sumClientReceiptsInMonth(list, prevY, prevM)
    return {
      thisMonthReceipts: cur,
      receiptsMoM: monthOverMonth(cur, prev),
      revenueSeries: monthlyClientReceipts(list, y, m, 6),
    }
  }, [payments.data])

  // 即将到期（文档 ≤30 天/已过期）
  const expiringDocItems = useMemo(
    () => selectExpiringDocs(expiringDocs.data ?? [], customerById),
    [expiringDocs.data, customerById],
  )
  // 递交进度行（递交日期/状态从 stage_history 派生）
  const lodgementRows = useMemo(
    () => selectLodgementProgressRows(lodgements.data ?? [], stageHistory.data ?? [], caseById, customerById),
    [lodgements.data, stageHistory.data, caseById, customerById],
  )

  return {
    isPending,
    isError,
    overdueInstallments,
    priorityCustomers,
    debtTotals,
    customerDebts,
    myOpenTasks,
    todoCases,
    trtReminders,
    // 统计卡 / 阶段分布（全真实数据派生）
    activeCaseCount,
    activeCustomerCount,
    stageDistribution,
    thisMonthReceipts,
    receiptsMoM,
    revenueSeries,
    // Layout A 新模块
    expiringDocItems,
    lodgementRows,
    // 供「我的待办」按 customer_id 显示并链接客户名
    customerById,
  }
}
