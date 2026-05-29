import { computeAccounting } from './accounting'
import { getCustomerPaymentColor } from './finance'
import type { CustomerPaymentColor } from './finance'
import { utcDayDiff } from './dateDiff'
import type { Case, Customer, Installment, Payment, PaymentPlan, RecordRow } from '../types/models'

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

export function selectCustomerDebts(
  plans: PaymentPlan[],
  payments: Pick<Payment, 'case_id' | 'direction' | 'amount'>[],
  caseById: CaseMap,
  customerById: CustomerMap,
): CustomerDebtItem[] {
  const byCustomer = new Map<string, DebtAcc>()
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
      clientReceivable: 0,
      clientPaid: 0,
    }
    entry.clientOwes += Math.max(0, acct.clientOwes)
    entry.companyOwes += Math.max(0, acct.companyOwes)
    entry.clientReceivable += Number(plan.client_total ?? 0)
    entry.clientPaid += acct.clientPaid
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
