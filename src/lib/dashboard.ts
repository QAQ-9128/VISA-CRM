import { computeLodgementProgress } from './lodgementProgress'
import { computeAccounting } from './accounting'
import { utcDayDiff } from './dateDiff'
import { CUSTOMER_TIER_ORDER } from '../types/domain'
import type {
  Case,
  CaseDocument,
  Customer,
  Installment,
  Lodgement,
  Payment,
  PaymentPlan,
} from '../types/models'

type CaseMap = Record<string, Case>
type CustomerMap = Record<string, Customer>
type PlanMap = Record<string, PaymentPlan>

// ── 临近决签：pending 且剩余 ≤ thresholdDays ──────────────────
export interface UpcomingDecisionItem {
  lodgementId: string
  caseId: string
  customerName: string
  visaSubclass: string
  type: Lodgement['type']
  daysRemaining: number
}

export function selectUpcomingDecisions(
  lodgements: Lodgement[],
  caseById: CaseMap,
  customerById: CustomerMap,
  today: Date = new Date(),
  thresholdDays = 14,
): UpcomingDecisionItem[] {
  const items: UpcomingDecisionItem[] = []
  for (const l of lodgements) {
    if (l.outcome !== 'pending') continue
    const prog = computeLodgementProgress(l.lodged_date, l.dha_processing_days, today)
    if (!prog || prog.daysRemaining > thresholdDays) continue
    const c = caseById[l.case_id]
    items.push({
      lodgementId: l.id,
      caseId: l.case_id,
      visaSubclass: c?.visa_subclass ?? '',
      customerName: c ? customerById[c.customer_id]?.full_name ?? '' : '',
      type: l.type,
      daysRemaining: prog.daysRemaining,
    })
  }
  return items.sort((a, b) => a.daysRemaining - b.daysRemaining)
}

// ── 文件快过期：未归档、到期 ≤ thresholdDays（含已过期）────────
export interface ExpiringDocumentItem {
  documentId: string
  customerId: string
  customerName: string
  label: string
  daysRemaining: number
}

export function selectExpiringDocuments(
  documents: CaseDocument[],
  customerById: CustomerMap,
  today: Date = new Date(),
  thresholdDays = 30,
): ExpiringDocumentItem[] {
  const items: ExpiringDocumentItem[] = []
  for (const d of documents) {
    if (d.is_archived || !d.expiry_date) continue
    const daysRemaining = utcDayDiff(today, d.expiry_date)
    if (daysRemaining > thresholdDays) continue
    items.push({
      documentId: d.id,
      customerId: d.customer_id,
      customerName: customerById[d.customer_id]?.full_name ?? '',
      label: d.title || d.file_name || '文件',
      daysRemaining,
    })
  }
  return items.sort((a, b) => a.daysRemaining - b.daysRemaining)
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

// ── 优先客户：星标，按等级排序（未分级最后）────────────────
export function sortPriorityCustomers(customers: Customer[]): Customer[] {
  const order = (c: Customer) => (c.priority_tier ? CUSTOMER_TIER_ORDER[c.priority_tier] : 99)
  return customers
    .filter((c) => c.is_starred)
    .sort((a, b) => order(a) - order(b) || a.full_name.localeCompare(b.full_name))
}

// ── 欠款总览：客户欠款合计 / 欠主代理合计（按案件分组，负数不计）──
export interface DebtTotals {
  clientOwesTotal: number
  companyOwesTotal: number
}

export function computeDebtTotals(
  plans: PaymentPlan[],
  payments: Pick<Payment, 'case_id' | 'direction' | 'amount'>[],
): DebtTotals {
  let clientOwesTotal = 0
  let companyOwesTotal = 0
  for (const plan of plans) {
    const casePayments = payments.filter((p) => p.case_id === plan.case_id)
    const acct = computeAccounting(plan, casePayments)
    clientOwesTotal += Math.max(0, acct.clientOwes)
    companyOwesTotal += Math.max(0, acct.companyOwes)
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
}

export function selectCustomerDebts(
  plans: PaymentPlan[],
  payments: Pick<Payment, 'case_id' | 'direction' | 'amount'>[],
  caseById: CaseMap,
  customerById: CustomerMap,
): CustomerDebtItem[] {
  const byCustomer = new Map<string, CustomerDebtItem>()
  for (const plan of plans) {
    const c = caseById[plan.case_id]
    if (!c) continue
    const customerId = c.customer_id
    const acct = computeAccounting(
      plan,
      payments.filter((p) => p.case_id === plan.case_id),
    )
    const entry = byCustomer.get(customerId) ?? {
      customerId,
      customerName: customerById[customerId]?.full_name ?? '',
      clientOwes: 0,
      companyOwes: 0,
    }
    entry.clientOwes += Math.max(0, acct.clientOwes)
    entry.companyOwes += Math.max(0, acct.companyOwes)
    byCustomer.set(customerId, entry)
  }
  return [...byCustomer.values()]
    .map((e) => ({
      ...e,
      clientOwes: Math.round(e.clientOwes * 100) / 100,
      companyOwes: Math.round(e.companyOwes * 100) / 100,
    }))
    .filter((e) => e.clientOwes > 0 || e.companyOwes > 0)
    .sort((a, b) => b.clientOwes - a.clientOwes || b.companyOwes - a.companyOwes)
}
