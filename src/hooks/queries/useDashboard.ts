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
import {
  caseCategoryDistribution,
  computeDebtTotals,
  countActiveCases,
  selectActionCases,
  selectCustomerDebts,
  selectExpiringDocs,
  selectOverdueInstallments,
  selectTodoCases,
  sumClientReceiptsInMonth,
} from '../../lib/dashboard'
import { listAllCaseApplicants } from '../../api/caseApplicants'
import { listAllStageHistory } from '../../api/cases'
import { selectTrtReminders } from '../../lib/trt'
import { selectCohabReminders } from '../../lib/cohab'
import { visibleCaseIds } from '../../lib/visibility'
import { queryKeys } from './keys'

function keyById<T extends { id: string }>(rows: T[]): Record<string, T> {
  const map: Record<string, T> = {}
  for (const r of rows) map[r.id] = r
  return map
}

/** 概览首页所需的全部预警，由若干查询组合 + 纯选择器派生。 */
export function useDashboard() {
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
  const stageHistory = useQuery({ queryKey: queryKeys.cases.stageHistoryAll, queryFn: listAllStageHistory })
  const expiringDocs = useQuery({ queryKey: queryKeys.dashboard.expiringDocs, queryFn: getExpiringDocuments })
  // 参与人：案件可见性（任一参与人在册即可见）用；与财务页共享缓存键
  const caseApplicants = useQuery({ queryKey: queryKeys.caseApplicants.all, queryFn: listAllCaseApplicants })

  const all = [unpaidInstallments, activeCases, activeCustomers, plans, payments, planItems, stageHistory, expiringDocs, caseApplicants]
  const isPending = all.some((q) => q.isPending)
  const isError = all.some((q) => q.isError)

  const caseById = useMemo(() => keyById(activeCases.data ?? []), [activeCases.data])
  const customerById = useMemo(() => keyById(activeCustomers.data ?? []), [activeCustomers.data])
  const planById = useMemo(() => keyById(plans.data ?? []), [plans.data])

  // 全员归档的案件从各卡片隐藏（任一参与人在册即可见，与递交进度/财务同口径）
  const visibleIds = useMemo(
    () => visibleCaseIds(activeCases.data ?? [], customerById, caseApplicants.data ?? []),
    [activeCases.data, customerById, caseApplicants.data],
  )
  const visibleCases = useMemo(
    () => (activeCases.data ?? []).filter((c) => visibleIds.has(c.id)),
    [activeCases.data, visibleIds],
  )
  const visiblePlans = useMemo(
    () => (plans.data ?? []).filter((p) => visibleIds.has(p.case_id)),
    [plans.data, visibleIds],
  )
  // 归档案件的款不计入概览 KPI（与 /finance 的 visiblePayments 同口径，两页数字一致）
  const visiblePayments = useMemo(
    () => (payments.data ?? []).filter((p) => visibleIds.has(p.case_id)),
    [payments.data, visibleIds],
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
  // 对称传 visiblePayments（与 visiblePlans 同口径）：结果与传全量等价——selector 内部按
  // p.case_id === plan.case_id 关联，不可见案件的付款本就挂不上可见 plan；显式过滤消除隐式依赖。
  const debtTotals = useMemo(
    () => computeDebtTotals(visiblePlans, visiblePayments, planItems.data ?? []),
    [visiblePlans, visiblePayments, planItems.data],
  )
  const customerDebts = useMemo(
    () => selectCustomerDebts(visiblePlans, visiblePayments, caseById, customerById, planItems.data ?? []),
    [visiblePlans, visiblePayments, caseById, customerById, planItems.data],
  )
  // 待办案件：current_stage='todo' 且未归档，按 created_at 倒序；带在册参与人（名字各自可点）
  const todoCases = useMemo(
    () => selectTodoCases(visibleCases, customerById, caseApplicants.data ?? []),
    [visibleCases, customerById, caseApplicants.data],
  )
  // 需要行动案件：current_stage 类别为 action（补件/上诉等），概览主角区左栏顶部
  const actionCases = useMemo(
    () => selectActionCases(visibleCases, customerById, caseApplicants.data ?? []),
    [visibleCases, customerById, caseApplicants.data],
  )
  // 转 186 TRT 提醒：只看可见案件
  const trtReminders = useMemo(
    () => selectTrtReminders(visibleCases, stageHistory.data ?? [], customerById),
    [visibleCases, stageHistory.data, customerById],
  )
  // 186/配偶签「3 个月更新同居材料」循环提醒：同口径
  const cohabReminders = useMemo(
    () => selectCohabReminders(visibleCases, stageHistory.data ?? [], customerById),
    [visibleCases, stageHistory.data, customerById],
  )

  // ── 概览统计卡（全真实数据；计数/分布与递交进度同一可见性口径）──────
  const activeCaseCount = useMemo(() => countActiveCases(visibleCases), [visibleCases])
  // 环图按状态 6 类聚合（每段一类一色）；已下签数单独给（环图标题用）
  const categoryDistribution = useMemo(() => caseCategoryDistribution(visibleCases), [visibleCases])
  const grantedCount = useMemo(
    () => visibleCases.filter((c) => !c.is_archived && c.current_stage === 'granted').length,
    [visibleCases],
  )
  // 本月收款（按 paid_at 落月，from_client 方向；归档案件已被 visiblePayments 过滤）
  const thisMonthReceipts = useMemo(() => {
    const now = new Date()
    return sumClientReceiptsInMonth(visiblePayments, now.getFullYear(), now.getMonth())
  }, [visiblePayments])

  // 即将到期（文档 ≤30 天/已过期）；caseById 来自在册案件 → 归档案件名下的文件一并隐藏
  const expiringDocItems = useMemo(
    () => selectExpiringDocs(expiringDocs.data ?? [], customerById, caseById),
    [expiringDocs.data, customerById, caseById],
  )

  return {
    isPending,
    isError,
    overdueInstallments,
    debtTotals,
    customerDebts,
    todoCases,
    actionCases,
    trtReminders,
    cohabReminders,
    // 统计卡 / 阶段分布（全真实数据派生）
    activeCaseCount,
    categoryDistribution,
    grantedCount,
    thisMonthReceipts,
    expiringDocItems,
    // 供卡片按 customer_id 显示并链接客户名
    customerById,
  }
}
