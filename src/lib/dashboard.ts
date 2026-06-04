import { computeAccounting } from './accounting'
import { formatVisaType } from './visa'
import { getCaseTotals } from './planItems'
import { getCustomerPaymentColor } from './finance'
import type { CustomerPaymentColor } from './finance'
import { utcDayDiff } from './dateDiff'
import { computeExpiryStatus } from './expiry'
import { computeLodgementProgress } from './lodgementProgress'
import { getLodgementLodgedDate, getLodgementStatus } from './lodgementStatus'
import {
  CASE_STAGES,
  CASE_STAGE_COLOR,
  CASE_STAGE_LABELS,
  DOC_TYPE_LABELS,
  LODGEMENT_TYPE_LABELS,
} from '../types/domain'
import type { CaseStage } from '../types/domain'
import type {
  Case,
  CaseDocument,
  CaseStageHistory,
  Customer,
  Installment,
  Lodgement,
  Payment,
  PaymentPlan,
  PaymentPlanItem,
  RecordRow,
} from '../types/models'

type CaseMap = Record<string, Case>
type CustomerMap = Record<string, Customer>
type PlanMap = Record<string, PaymentPlan>

// ── 概览统计卡（全部派生自真实数据，无趋势造假）────────────────

/** 进行中案件：未归档且阶段非终态（下签/拒签/撤签）。 */
const TERMINAL_STAGES: ReadonlySet<CaseStage> = new Set(['granted', 'refused', 'withdrawn'])
export function countActiveCases(cases: Case[]): number {
  return cases.filter((c) => !c.is_archived && !TERMINAL_STAGES.has(c.current_stage)).length
}

// ── 案件阶段分布：按 current_stage 统计未归档案件 ────────────────
export interface StageDatum {
  stage: CaseStage
  label: string
  count: number
  /** 十六进制实心色，用于条形/圆点填充 */
  color: string
}

/** 按 CASE_STAGES 流程顺序返回有案件的阶段（count>0）。 */
export function caseStageDistribution(cases: Case[]): StageDatum[] {
  const counts = new Map<CaseStage, number>()
  for (const c of cases) {
    if (c.is_archived) continue
    counts.set(c.current_stage, (counts.get(c.current_stage) ?? 0) + 1)
  }
  return CASE_STAGES.filter((s) => (counts.get(s) ?? 0) > 0).map((s) => ({
    stage: s,
    label: CASE_STAGE_LABELS[s],
    count: counts.get(s) ?? 0,
    color: CASE_STAGE_COLOR[s],
  }))
}

// ── 本月收款：某月 from_client 收款合计（按 paid_at 落月）──────────
/** monthIndex0：0=一月。金额可能是 supabase numeric 字符串，强转。 */
export function sumClientReceiptsInMonth(
  payments: Pick<Payment, 'direction' | 'amount' | 'paid_at'>[],
  year: number,
  monthIndex0: number,
): number {
  const ym = `${year}-${String(monthIndex0 + 1).padStart(2, '0')}`
  let sum = 0
  for (const p of payments) {
    if (p.direction !== 'from_client' || !p.paid_at) continue
    if (p.paid_at.slice(0, 7) !== ym) continue
    sum += Number(p.amount) || 0
  }
  return Math.round(sum * 100) / 100
}

// ── 月环比：方向 + 百分比（上月为 0 时无可比百分比）────────────────
export interface MonthOverMonth {
  /** 变化百分比（保留一位小数）；上月为 0 时为 null（无法计算环比） */
  pct: number | null
  dir: 'up' | 'down' | 'flat'
}

export function monthOverMonth(current: number, previous: number): MonthOverMonth {
  if (previous === 0) return { pct: null, dir: current > 0 ? 'up' : 'flat' }
  const change = (current - previous) / previous
  if (Math.abs(change) < 0.0005) return { pct: 0, dir: 'flat' }
  return { pct: Math.round(Math.abs(change) * 1000) / 10, dir: change > 0 ? 'up' : 'down' }
}

// ── 近 N 月客户收款序列（月度收款条形图用）──────────────────────
export interface RevenueBar {
  label: string
  value: number
  /** 末月（当月）高亮 */
  hi: boolean
}

/** 截至 (year, monthIndex0) 往前数 count 个月，每月 from_client 收款合计。 */
export function monthlyClientReceipts(
  payments: Pick<Payment, 'direction' | 'amount' | 'paid_at'>[],
  year: number,
  monthIndex0: number,
  count = 6,
): RevenueBar[] {
  const out: RevenueBar[] = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(year, monthIndex0 - i, 1))
    const y = d.getUTCFullYear()
    const m = d.getUTCMonth()
    out.push({ label: `${m + 1}月`, value: sumClientReceiptsInMonth(payments, y, m), hi: i === 0 })
  }
  return out
}

// ── 即将到期：文档到期 ≤30 天或已过期（合并 TRT 在前端组装）──────────
export interface ExpiringDocItem {
  id: string
  customerId: string
  customerName: string
  /** 文件类型中文标签 */
  label: string
  daysRemaining: number
  status: 'overdue' | 'soon'
  /** 紧急度配色：逾期或 ≤7 天 rose，否则 amber */
  tone: 'rose' | 'amber'
  /** 图标井用图标名 */
  ic: 'clock' | 'passport' | 'doc'
}

const DOC_ICON: Partial<Record<CaseDocument['doc_type'], ExpiringDocItem['ic']>> = {
  medical: 'clock',
  passport: 'passport',
}

export function selectExpiringDocs(
  documents: CaseDocument[],
  customerById: CustomerMap,
  today: Date = new Date(),
  soonThresholdDays = 30,
): ExpiringDocItem[] {
  const items: ExpiringDocItem[] = []
  for (const d of documents) {
    if (d.is_archived) continue
    const customer = customerById[d.customer_id]
    if (!customer) continue // 归档/不存在的客户不列入
    const info = computeExpiryStatus(d.expiry_date, today, soonThresholdDays)
    if (!info || info.status === 'ok') continue
    items.push({
      id: d.id,
      customerId: d.customer_id,
      customerName: customer.full_name,
      label: DOC_TYPE_LABELS[d.doc_type],
      daysRemaining: info.daysRemaining,
      status: info.status,
      tone: info.status === 'overdue' || info.daysRemaining <= 7 ? 'rose' : 'amber',
      ic: DOC_ICON[d.doc_type] ?? 'doc',
    })
  }
  return items.sort((a, b) => a.daysRemaining - b.daysRemaining)
}

// ── 递交进度行（递交进度表用）：递交日期/状态从 case_stage_history 派生 ──────
export interface LodgementProgressRow {
  id: string
  name: string
  /** 签证类型 + 提名/签证，如「482 提名」 */
  visa: string
  /** 派生递交日期 YYYY-MM-DD */
  date: string
  statusLabel: string
  statusTone: 'blue' | 'emerald' | 'rose'
  percentElapsed: number
  /** 进度条颜色（十六进制） */
  barColor: string
  elapsedDays: number
  /** 右侧剩余/超期/完成文案 */
  remainingText: string
}

export function selectLodgementProgressRows(
  lodgements: Lodgement[],
  stageHistory: CaseStageHistory[],
  caseById: CaseMap,
  customerById: CustomerMap,
  today: Date = new Date(),
): LodgementProgressRow[] {
  const historyByCase = new Map<string, CaseStageHistory[]>()
  for (const h of stageHistory) {
    const list = historyByCase.get(h.case_id) ?? []
    list.push(h)
    historyByCase.set(h.case_id, list)
  }

  const rows: LodgementProgressRow[] = []
  for (const lg of lodgements) {
    const c = caseById[lg.case_id]
    if (!c) continue
    const history = historyByCase.get(lg.case_id) ?? []
    const lodgedDate = getLodgementLodgedDate(history, lg.type)
    if (!lodgedDate) continue // 未递交 → 不进进度表
    const progress = computeLodgementProgress(lodgedDate, lg.dha_processing_days, today)
    if (!progress) continue // 无 DHA 处理天数 → 无法算进度
    const status = getLodgementStatus(c.current_stage, lg.type, history)

    let statusLabel: string
    let statusTone: LodgementProgressRow['statusTone']
    let barColor: string
    let remainingText: string
    if (status === 'approved') {
      statusLabel = '已批'
      statusTone = 'emerald'
      barColor = '#10b981'
      remainingText = '已完成'
    } else if (status === 'refused' || progress.isOverdue) {
      statusLabel = status === 'refused' ? '已拒' : '已超期'
      statusTone = 'rose'
      barColor = '#f43f5e'
      remainingText = progress.isOverdue ? `超 ${-progress.daysRemaining} 天` : `剩 ${progress.daysRemaining} 天`
    } else {
      statusLabel = '处理中'
      statusTone = 'blue'
      barColor = progress.percentElapsed > 80 ? '#f59e0b' : '#3b6bff'
      remainingText = `剩 ${progress.daysRemaining} 天`
    }

    rows.push({
      id: lg.id,
      name: customerById[c.customer_id]?.full_name ?? '',
      visa: `${c.visa_subclass} ${LODGEMENT_TYPE_LABELS[lg.type]}`,
      date: lodgedDate,
      statusLabel,
      statusTone,
      percentElapsed: progress.percentElapsed,
      barColor,
      elapsedDays: progress.daysElapsed,
      remainingText,
    })
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
}

// ── 待办客户清单：有未完成待办的客户（按客户去重 + 计数）──────────
export interface CustomerOpenTasks {
  customerId: string
  customerName: string
  openCount: number
}

export function selectCustomersWithOpenTasks(
  openTasks: RecordRow[],
  customerById: CustomerMap,
): CustomerOpenTasks[] {
  const byCustomer = new Map<string, CustomerOpenTasks>()
  for (const t of openTasks) {
    if (t.type !== 'task' || t.is_done || !t.customer_id) continue
    const customer = customerById[t.customer_id]
    if (!customer) continue // 不在册（归档/不存在）的客户不列入
    const entry =
      byCustomer.get(t.customer_id) ?? {
        customerId: t.customer_id,
        customerName: customer.full_name,
        openCount: 0,
      }
    entry.openCount += 1
    byCustomer.set(t.customer_id, entry)
  }
  return [...byCustomer.values()].sort(
    (a, b) => b.openCount - a.openCount || a.customerName.localeCompare(b.customerName),
  )
}

// ── 待办案件：current_stage = 'todo' 且未归档，按 created_at 倒序 ──────────
export interface TodoCaseItem {
  caseId: string
  customerId: string
  customerName: string
  /** 签证类型（含子类别，如 482/Core Skills） */
  visaLabel: string
}

export function selectTodoCases(cases: Case[], customerById: CustomerMap): TodoCaseItem[] {
  return cases
    .filter((c) => c.current_stage === 'todo' && !c.is_archived)
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id))
    .map((c) => ({
      caseId: c.id,
      customerId: c.customer_id,
      customerName: customerById[c.customer_id]?.full_name ?? '',
      visaLabel: formatVisaType(c.visa_subclass, c.visa_stream),
    }))
}

// ── 逾期未付款：未付且 due_date < 今天 ───────────────────────
export interface OverdueInstallmentItem {
  installmentId: string
  caseId: string
  /** 案件客户 id（跳客户详情并选中该案用） */
  customerId: string
  customerName: string
  amount: number | string
  dueDate: string
  daysOverdue: number
}

export function selectOverdueInstallments(
  installments: Installment[],
  planById: PlanMap,
  caseById: CaseMap,
  customerById: CustomerMap,
  today: Date = new Date(),
): OverdueInstallmentItem[] {
  const items: OverdueInstallmentItem[] = []
  for (const i of installments) {
    if (i.is_paid || !i.due_date) continue
    const diff = utcDayDiff(today, i.due_date)
    if (diff >= 0) continue
    const plan = planById[i.payment_plan_id]
    const c = plan ? caseById[plan.case_id] : undefined
    items.push({
      installmentId: i.id,
      caseId: plan?.case_id ?? '',
      customerId: c?.customer_id ?? '',
      customerName: c ? customerById[c.customer_id]?.full_name ?? '' : '',
      amount: i.amount,
      dueDate: i.due_date,
      daysOverdue: -diff,
    })
  }
  return items.sort((a, b) => b.daysOverdue - a.daysOverdue)
}

// ── 星标客户：仅取 is_starred，按姓名排序（不再依赖等级/来源排序）──────
export function sortPriorityCustomers(customers: Customer[]): Customer[] {
  return customers
    .filter((c) => c.is_starred)
    .sort((a, b) => a.full_name.localeCompare(b.full_name))
}

// ── 欠款总览：客户欠款合计 / 欠主代理合计（按案件分组，负数不计）──
export interface DebtTotals {
  clientOwesTotal: number
  companyOwesTotal: number
}

export function computeDebtTotals(
  plans: PaymentPlan[],
  payments: Pick<Payment, 'case_id' | 'direction' | 'amount' | 'plan_item_id'>[],
  planItems: Pick<PaymentPlanItem, 'id' | 'plan_id' | 'amount_due'>[] = [],
): DebtTotals {
  let clientOwesTotal = 0
  let companyOwesTotal = 0
  for (const plan of plans) {
    const casePayments = payments.filter((p) => p.case_id === plan.case_id)
    // 客户欠款从款项明细派生；付主代理仍走 computeAccounting（company_total 不变）
    const items = planItems.filter((i) => i.plan_id === plan.id)
    clientOwesTotal += Math.max(0, getCaseTotals(items, casePayments).totalUnpaid)
    companyOwesTotal += Math.max(0, computeAccounting(plan, casePayments).companyOwes)
  }
  return {
    clientOwesTotal: Math.round(clientOwesTotal * 100) / 100,
    companyOwesTotal: Math.round(companyOwesTotal * 100) / 100,
  }
}

// ── 按客户的欠款明细（跨该客户名下所有案件合计，负数不计）──────
export interface CustomerDebtItem {
  customerId: string
  customerName: string
  clientOwes: number
  companyOwes: number
  /** 客户名按应收状态着色：green=已付清 / blue=还欠钱 / default=未立案 */
  color: CustomerPaymentColor
}

interface DebtAcc {
  customerId: string
  customerName: string
  clientOwes: number
  companyOwes: number
  clientReceivable: number
  clientPaid: number
}

/**
 * 该 plan 的费用归集到哪个客户，优先级：
 *   1) plan.billed_to_customer_id —— 显式指定的实际付款方（可跨家庭组/介绍人/任何人）
 *   2) plan.applicant_id          —— 按申请人分开记账时，这张计划本就属于某副申请（与财务页归属一致）
 *   3) case.customer_id           —— 合并账单（applicant_id 为空）回落到案件主申请
 * 这样：副申请自己的账挂副申请名下、不再误算到主申请；billed_to 客户被删 set null 后自然回落到 2/3。
 */
export function planBilledToCustomerId(
  plan: Pick<PaymentPlan, 'case_id' | 'applicant_id' | 'billed_to_customer_id'>,
  caseById: CaseMap,
): string | null {
  return plan.billed_to_customer_id ?? plan.applicant_id ?? caseById[plan.case_id]?.customer_id ?? null
}

export function selectCustomerDebts(
  plans: PaymentPlan[],
  payments: Pick<Payment, 'case_id' | 'direction' | 'amount' | 'plan_item_id'>[],
  caseById: CaseMap,
  customerById: CustomerMap,
  planItems: Pick<PaymentPlanItem, 'id' | 'plan_id' | 'amount_due'>[] = [],
): CustomerDebtItem[] {
  const byCustomer = new Map<string, DebtAcc>()
  for (const plan of plans) {
    const c = caseById[plan.case_id]
    if (!c) continue
    const customerId = planBilledToCustomerId(plan, caseById)
    if (!customerId) continue
    const casePayments = payments.filter((p) => p.case_id === plan.case_id)
    // 客户侧应收/已付/未付从款项明细派生；付主代理仍走 computeAccounting
    const totals = getCaseTotals(planItems.filter((i) => i.plan_id === plan.id), casePayments)
    const companyOwes = computeAccounting(plan, casePayments).companyOwes
    const entry = byCustomer.get(customerId) ?? {
      customerId,
      customerName: customerById[customerId]?.full_name ?? '',
      clientOwes: 0,
      companyOwes: 0,
      clientReceivable: 0,
      clientPaid: 0,
    }
    entry.clientOwes += Math.max(0, totals.totalUnpaid)
    entry.companyOwes += Math.max(0, companyOwes)
    entry.clientReceivable += totals.totalDue
    entry.clientPaid += totals.totalPaid
    byCustomer.set(customerId, entry)
  }
  return [...byCustomer.values()]
    .map((e) => ({
      customerId: e.customerId,
      customerName: e.customerName,
      clientOwes: Math.round(e.clientOwes * 100) / 100,
      companyOwes: Math.round(e.companyOwes * 100) / 100,
      color: getCustomerPaymentColor(e.clientReceivable, e.clientPaid, e.clientOwes),
    }))
    .filter((e) => e.clientOwes > 0 || e.companyOwes > 0)
    .sort((a, b) => b.clientOwes - a.clientOwes || b.companyOwes - a.companyOwes)
}

export interface CustomerDebtSummary {
  clientOwes: number
  companyOwes: number
  color: CustomerPaymentColor
}

/**
 * 某客户名下「归集欠款」汇总：聚合所有 billed_to 指向该客户的案件费用——
 * 含他作主申请的案件（billed_to 为空回落主申）+ 他被设为 billed_to 的别人案件。
 * 客户详情页「欠款」区与客户列表付款颜色都按此口径。
 */
export function selectCustomerDebtSummary(
  customerId: string,
  plans: PaymentPlan[],
  payments: Pick<Payment, 'case_id' | 'direction' | 'amount' | 'plan_item_id'>[],
  caseById: CaseMap,
  planItems: Pick<PaymentPlanItem, 'id' | 'plan_id' | 'amount_due'>[] = [],
): CustomerDebtSummary {
  let clientOwes = 0
  let companyOwes = 0
  let clientReceivable = 0
  let clientPaid = 0
  for (const plan of plans) {
    if (planBilledToCustomerId(plan, caseById) !== customerId) continue
    const casePayments = payments.filter((p) => p.case_id === plan.case_id)
    const totals = getCaseTotals(planItems.filter((i) => i.plan_id === plan.id), casePayments)
    clientOwes += Math.max(0, totals.totalUnpaid)
    companyOwes += Math.max(0, computeAccounting(plan, casePayments).companyOwes)
    clientReceivable += totals.totalDue
    clientPaid += totals.totalPaid
  }
  return {
    clientOwes: Math.round(clientOwes * 100) / 100,
    companyOwes: Math.round(companyOwes * 100) / 100,
    color: getCustomerPaymentColor(clientReceivable, clientPaid, clientOwes),
  }
}
