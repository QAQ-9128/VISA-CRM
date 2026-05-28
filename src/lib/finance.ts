import { computeAccounting } from './accounting'
import type { Case, CaseApplicant, Customer, Payment, PaymentPlan, Referrer } from '../types/models'
import type { PaymentMethod } from '../types/domain'

type AmountLike = number | string | null | undefined
const num = (v: AmountLike): number => {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}
const round2 = (n: number): number => Math.round(n * 100) / 100

type CaseMap = Record<string, Case>
type CustomerMap = Record<string, Customer>
type ReferrerMap = Record<string, Referrer>

// ── 应收汇总（按「账单单元」一行；复用 computeAccounting，未付负数计 0）────────
// 账单单元 = (案件, 申请人)：
//   同步案件 → 一份合并单元（applicant_id 为空，覆盖主+副）；
//   不同步案件 → 主申 + 每个副申各一份单元（applicant_id = 各申请人）。
// 应收=plan.client_total，已付=Σ from_client，未付=max(0, 应收−已付)。
/** 账单单元角色：merged=同步合并（覆盖主+副）；primary=主申；secondary=副申。 */
export type ReceivableRole = 'merged' | 'primary' | 'secondary'

export interface ReceivableRow {
  caseId: string
  /** 账单归属申请人；null = 合并(同步) */
  applicantId: string | null
  role: ReceivableRole
  /** 仅 merged 行：同案副申名字（让主+副在一行里都看得到） */
  coApplicantNames: string[]
  /** 该账单单元的付款计划 id；null 表示尚未创建（页面上设应收时再创建） */
  planId: string | null
  /** 可点击跳转的客户：同步=主申，不同步=该申请人 */
  customerId: string
  customerName: string
  visaSubclass: string
  receivable: number
  paid: number
  unpaid: number
}

export function selectFinanceReceivables(
  cases: Case[],
  caseApplicants: CaseApplicant[],
  plans: PaymentPlan[],
  payments: Pick<Payment, 'case_id' | 'applicant_id' | 'direction' | 'amount'>[],
  customerById: CustomerMap,
): ReceivableRow[] {
  const subsByCase = new Map<string, string[]>()
  for (const a of caseApplicants) {
    const list = subsByCase.get(a.case_id) ?? []
    list.push(a.customer_id)
    subsByCase.set(a.case_id, list)
  }
  const planFor = (caseId: string, applicantId: string | null) =>
    plans.find((p) => p.case_id === caseId && (p.applicant_id ?? null) === applicantId) ?? null

  const unitRow = (
    c: Case,
    applicantId: string | null,
    role: ReceivableRole,
    coApplicantNames: string[],
    unitPayments: Pick<Payment, 'direction' | 'amount'>[],
  ): ReceivableRow => {
    const plan = planFor(c.id, applicantId)
    const acct = computeAccounting(plan, unitPayments)
    const linkId = applicantId ?? c.customer_id
    return {
      caseId: c.id,
      applicantId,
      role,
      coApplicantNames,
      planId: plan?.id ?? null,
      customerId: linkId,
      customerName: customerById[linkId]?.full_name ?? '',
      visaSubclass: c.visa_subclass,
      receivable: round2(num(plan?.client_total)),
      paid: round2(acct.clientPaid),
      unpaid: round2(Math.max(0, acct.clientOwes)),
    }
  }

  const rows: ReceivableRow[] = []
  for (const c of cases) {
    const casePayments = payments.filter((p) => p.case_id === c.id)
    const subIds = subsByCase.get(c.id) ?? []
    if (c.sync_tracking) {
      const subNames = subIds.map((id) => customerById[id]?.full_name ?? '').filter(Boolean)
      rows.push(unitRow(c, null, 'merged', subNames, casePayments)) // 合并：全案付款 + 列出主/副
    } else {
      // 主申 + 各副申各一份；主申在前
      rows.push(
        unitRow(c, c.customer_id, 'primary', [], casePayments.filter((p) => (p.applicant_id ?? null) === c.customer_id)),
      )
      for (const aid of subIds) {
        rows.push(
          unitRow(c, aid, 'secondary', [], casePayments.filter((p) => (p.applicant_id ?? null) === aid)),
        )
      }
    }
  }

  // 同一案件的主/副排在一起：先按案件未付合计降序分组，组内主/合并在前、副申其后
  const caseUnpaid = new Map<string, number>()
  for (const r of rows) caseUnpaid.set(r.caseId, (caseUnpaid.get(r.caseId) ?? 0) + r.unpaid)
  const roleRank = (r: ReceivableRow) => (r.role === 'secondary' ? 1 : 0)
  return rows.sort(
    (a, b) =>
      (caseUnpaid.get(b.caseId) ?? 0) - (caseUnpaid.get(a.caseId) ?? 0) ||
      a.caseId.localeCompare(b.caseId) ||
      roleRank(a) - roleRank(b) ||
      a.customerName.localeCompare(b.customerName),
  )
}

export interface ReceivableTotals {
  receivable: number
  paid: number
  unpaid: number
}

export function sumFinanceReceivables(rows: ReceivableRow[]): ReceivableTotals {
  const t = rows.reduce(
    (acc, r) => ({
      receivable: acc.receivable + r.receivable,
      paid: acc.paid + r.paid,
      unpaid: acc.unpaid + r.unpaid,
    }),
    { receivable: 0, paid: 0, unpaid: 0 },
  )
  return { receivable: round2(t.receivable), paid: round2(t.paid), unpaid: round2(t.unpaid) }
}

// ── 收款明细（from_client；负数不计入合计）──────────────────────────────────
export interface ReceiptItem {
  paymentId: string
  amount: number
  method: PaymentMethod
  customerName: string
  customerId: string
  visaSubclass: string
  /** 这笔收款对应的案件编号（发票与案件编号绑定用） */
  caseNumber: string
  paidAt: string | null
  note: string | null
  caseId: string
  /** 已附发票的 Storage 路径 / 原始文件名；未上传为 null */
  invoicePath: string | null
  invoiceName: string | null
}

export interface FinanceReceipts {
  items: ReceiptItem[]
  total: number
}

export function selectFinanceReceipts(
  payments: Payment[],
  caseById: CaseMap,
  customerById: CustomerMap,
): FinanceReceipts {
  const items: ReceiptItem[] = []
  let total = 0
  for (const p of payments) {
    if (p.direction !== 'from_client') continue
    const c = caseById[p.case_id]
    const customer = c ? customerById[c.customer_id] : undefined
    total += Math.max(0, num(p.amount))
    items.push({
      paymentId: p.id,
      amount: num(p.amount),
      method: p.method,
      customerName: customer?.full_name ?? '',
      customerId: c?.customer_id ?? '',
      visaSubclass: c?.visa_subclass ?? '',
      caseNumber: c?.case_number ?? '',
      paidAt: p.paid_at,
      note: p.note,
      caseId: p.case_id,
      invoicePath: p.invoice_path,
      invoiceName: p.invoice_name,
    })
  }
  items.sort((a, b) => (b.paidAt ?? '').localeCompare(a.paidAt ?? ''))
  return { items, total: round2(total) }
}

// ── 支出/付款明细（付主代理 + 付介绍人；负数不计入合计）──────────────────────
export interface PayoutItem {
  paymentId: string
  direction: 'to_company' | 'to_referrer'
  amount: number
  method: PaymentMethod
  customerName: string
  /** 仅 to_referrer 有值：对应客户的介绍人 */
  referrerName: string | null
  paidAt: string | null
  note: string | null
  caseId: string
}

export interface FinancePayouts {
  items: PayoutItem[]
  toCompanyTotal: number
  toReferrerTotal: number
}

export function selectFinancePayouts(
  payments: Payment[],
  caseById: CaseMap,
  customerById: CustomerMap,
  referrerById: ReferrerMap,
): FinancePayouts {
  const items: PayoutItem[] = []
  let toCompanyTotal = 0
  let toReferrerTotal = 0
  for (const p of payments) {
    if (p.direction !== 'to_company' && p.direction !== 'to_referrer') continue
    const c = caseById[p.case_id]
    const customer = c ? customerById[c.customer_id] : undefined
    const referrer =
      p.direction === 'to_referrer' && customer?.referrer_id
        ? referrerById[customer.referrer_id]
        : undefined
    const positive = Math.max(0, num(p.amount))
    if (p.direction === 'to_company') toCompanyTotal += positive
    else toReferrerTotal += positive
    items.push({
      paymentId: p.id,
      direction: p.direction,
      amount: num(p.amount),
      method: p.method,
      customerName: customer?.full_name ?? '',
      referrerName: referrer?.name ?? null,
      paidAt: p.paid_at,
      note: p.note,
      caseId: p.case_id,
    })
  }
  items.sort((a, b) => (b.paidAt ?? '').localeCompare(a.paidAt ?? ''))
  return { items, toCompanyTotal: round2(toCompanyTotal), toReferrerTotal: round2(toReferrerTotal) }
}

// ── 按客户聚合（客户详情页用）：复用上面三个选择器，仅把数据限定到该客户的案件 ──
export interface CustomerFinance {
  receivables: ReceivableRow[]
  receivableTotals: ReceivableTotals
  receipts: FinanceReceipts
  payouts: FinancePayouts
}

export function selectCustomerFinance(
  customerId: string,
  cases: Case[],
  caseApplicants: CaseApplicant[],
  plans: PaymentPlan[],
  payments: Payment[],
  customerById: CustomerMap,
  referrerById: ReferrerMap,
): CustomerFinance {
  // 该客户作为主申的案件（家庭账单挂在主申名下管理）
  const myCases = cases.filter((c) => c.customer_id === customerId)
  const myCaseIds = new Set(myCases.map((c) => c.id))
  const caseById: CaseMap = Object.fromEntries(myCases.map((c) => [c.id, c]))
  const myApplicants = caseApplicants.filter((a) => myCaseIds.has(a.case_id))
  const myPlans = plans.filter((p) => myCaseIds.has(p.case_id))
  const myPayments = payments.filter((p) => myCaseIds.has(p.case_id))
  const receivables = selectFinanceReceivables(myCases, myApplicants, myPlans, myPayments, customerById)
  return {
    receivables,
    receivableTotals: sumFinanceReceivables(receivables),
    receipts: selectFinanceReceipts(myPayments, caseById, customerById),
    payouts: selectFinancePayouts(myPayments, caseById, customerById, referrerById),
  }
}
