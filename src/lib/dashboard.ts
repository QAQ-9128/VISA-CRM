import { computeAccounting } from './accounting'
import { formatVisaType } from './visa'
import { getCaseTotals } from './planItems'
import { getCustomerPaymentColor } from './finance'
import type { CustomerPaymentColor } from './finance'
import { utcDayDiff } from './dateDiff'
import { computeExpiryStatus } from './expiry'
import { STATUS_CATEGORY_META, stageCategory } from './statusColor'
import type { StatusCategory } from './statusColor'
import { DOC_TYPE_LABELS } from '../types/domain'
import type { CaseStage } from '../types/domain'
import type {
  Case,
  CaseApplicant,
  CaseDocument,
  Customer,
  Installment,
  Payment,
  PaymentPlan,
  PaymentPlanItem,
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

// ── 案件分布（概览环图）：按状态 6 类聚合，不再逐阶段出段 ────────────────
// 6 色统一后「提名递交/签证递交」等同类阶段共色，逐阶段出段会让环上相邻段同色不可分；
// 改为类别聚合：每段一类一色（紫待办/蓝等待/灰进行中/黄需行动/绿完成），终止类(拒签/撤签)不入环。
export interface CategoryDatum {
  category: StatusCategory
  label: string
  count: number
  /** 十六进制实心色，用于环段/圆点填充 */
  color: string
}

const RING_CATEGORY_ORDER: readonly StatusCategory[] = ['todo', 'waiting', 'inProgress', 'action', 'done']

export function caseCategoryDistribution(cases: Case[]): CategoryDatum[] {
  const counts = new Map<StatusCategory, number>()
  for (const c of cases) {
    if (c.is_archived) continue
    const cat = stageCategory(c.current_stage)
    if (cat === 'terminated') continue
    counts.set(cat, (counts.get(cat) ?? 0) + 1)
  }
  return RING_CATEGORY_ORDER.filter((k) => (counts.get(k) ?? 0) > 0).map((k) => ({
    category: k,
    label: STATUS_CATEGORY_META[k].label,
    count: counts.get(k) ?? 0,
    color: STATUS_CATEGORY_META[k].solid,
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
  caseById: CaseMap,
  today: Date = new Date(),
  soonThresholdDays = 30,
): ExpiringDocItem[] {
  const items: ExpiringDocItem[] = []
  for (const d of documents) {
    if (d.is_archived) continue
    const customer = customerById[d.customer_id]
    if (!customer) continue // 归档/不存在的客户不列入
    if (d.case_id && !caseById[d.case_id]) continue // 所挂案件已归档 → 隐藏（与档案库口径一致）
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

// ── 待办案件：current_stage = 'todo' 且未归档，按 created_at 倒序 ──────────
export interface TodoCaseParticipant {
  id: string
  name: string
}

export interface TodoCaseItem {
  caseId: string
  /** 行点击/案件链接目标 = 首位在册参与人（案件客户在册则为案件客户） */
  customerId: string
  customerName: string
  /** 全部在册参与人（案件客户在前）；归档/被删的参与人不在在册映射里 → 自动消失 */
  participants: TodoCaseParticipant[]
  /** 签证类型（含子类别，如 482/Core Skills） */
  visaLabel: string
}

export function selectTodoCases(
  cases: Case[],
  customerById: CustomerMap,
  applicants: Pick<CaseApplicant, 'case_id' | 'customer_id'>[] = [],
): TodoCaseItem[] {
  const subsByCase = new Map<string, string[]>()
  for (const a of applicants) {
    const list = subsByCase.get(a.case_id) ?? []
    list.push(a.customer_id)
    subsByCase.set(a.case_id, list)
  }
  return cases
    .filter((c) => c.current_stage === 'todo' && !c.is_archived)
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id))
    .map((c) => {
      const ids = [...new Set([c.customer_id, ...(subsByCase.get(c.id) ?? [])])]
      // 在册参与人（customerById 来自未归档客户列表 → 归档/被删的人自然滤掉）
      const participants = ids
        .filter((id) => customerById[id])
        .map((id) => ({ id, name: customerById[id]?.full_name ?? '' }))
      const first = participants[0]
      return {
        caseId: c.id,
        customerId: first?.id ?? c.customer_id,
        customerName: first?.name ?? '',
        participants,
        visaLabel: formatVisaType(c.visa_subclass, c.visa_stream),
      }
    })
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
