import { computeAccounting } from './accounting'
import { formatVisaType } from './visa'
import { getCaseTotals } from './planItems'
import { getCustomerPaymentColor } from './finance'
import type { CustomerPaymentColor } from './finance'
import { utcDayDiff } from './dateDiff'
import type { Case, Customer, Installment, Payment, PaymentPlan, PaymentPlanItem, RecordRow } from '../types/models'

type CaseMap = Record<string, Case>
type CustomerMap = Record<string, Customer>
type PlanMap = Record<string, PaymentPlan>

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
 * 该 plan 的费用归集到哪个客户：优先 plan.billed_to_customer_id（实际付款方，可跨家庭组/介绍人/任何人），
 * 为空则回落到案件主申请 case.customer_id（向后兼容；billed_to 客户被删后 on delete set null 也回落此值）。
 */
export function planBilledToCustomerId(
  plan: Pick<PaymentPlan, 'case_id' | 'billed_to_customer_id'>,
  caseById: CaseMap,
): string | null {
  return plan.billed_to_customer_id ?? caseById[plan.case_id]?.customer_id ?? null
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
