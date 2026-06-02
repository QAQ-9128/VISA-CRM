import { getCaseTotals, getItemPaid } from './planItems'
import { stageUnitAmount } from './staged'
import { formatMoney } from './money'
import type {
  Case,
  CaseApplicant,
  Customer,
  Payment,
  PaymentPlan,
  PaymentPlanItem,
  Referrer,
} from '../types/models'
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

/**
 * 按月(YYYY-MM)过滤付款：只保留 paid_at 落在该月的记录；month 为 null = 全部（原样返回）。
 * 无 paid_at 的付款在选定具体月份时被排除（不属于任何月）。
 * 用日期字符串前缀比较（DST 安全）。仅用于收款明细 / 支出明细的按月口径，不影响应收余额。
 */
export function filterPaymentsByMonth<T extends { paid_at: string | null }>(
  payments: T[],
  month: string | null,
): T[] {
  if (!month) return payments
  return payments.filter((p) => !!p.paid_at && p.paid_at.slice(0, 7) === month)
}

/** 最近活动的 N 个案件：按 updated_at 倒序取前 N（同时间按 id 稳定）。不改原数组。 */
export function selectRecentCases(cases: Case[], limit: number): Case[] {
  return [...cases]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at) || a.id.localeCompare(b.id))
    .slice(0, limit)
}

// ── 应收汇总（按「账单单元」一行；复用 computeAccounting，未付负数计 0）────────
// 账单单元 = (案件, 申请人)：
//   财务合并(sync_tracking=true) → 一份合并单元（applicant_id 为空，覆盖主+副）；
//   财务分开(sync_tracking=false) → 主申 + 每个副申各一份单元（applicant_id = 各申请人）。
// 注：sync_tracking 现仅决定财务口径；案件进度追踪始终同步（见 casesTable）。
// 应收=plan.client_total，已付=Σ from_client，未付=max(0, 应收−已付)。
/** 账单单元角色：merged=同步合并（覆盖主+副）；primary=主申；secondary=副申。 */
export type ReceivableRole = 'merged' | 'primary' | 'secondary'

/** 单个阶段（payment_plan_item）的只读汇总，供「分 N 期」折叠子行用。 */
export interface StageSummary {
  stageId: string
  name: string
  /** 期数（纯乘数） */
  periods: number
  /** 每期金额 = 总计/期数（派生），用于「每期 X · 共 N 期」小行 */
  unitAmount: number
  /** 该阶段总计 = amount_due */
  receivable: number
  paid: number
  unpaid: number
}

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
  /** 该计划是否分阶段收费（驱动展开处显示阶段表/款项明细） */
  staged: boolean
  /** 各阶段（款项明细）只读汇总，按 created_at 升序；行级数值 = Σ stages。 */
  stages: StageSummary[]
}

/** 「未付 / 状态」chip：应收未设(=0)灰、已结清绿、欠款红。纯函数。 */
export function receivableStatus(r: { receivable: number; unpaid: number }): {
  kind: 'unset' | 'settled' | 'owing'
  label: string
} {
  if (r.receivable === 0) return { kind: 'unset', label: '未设应收' }
  if (r.unpaid <= 0) return { kind: 'settled', label: '已结清' }
  return { kind: 'owing', label: `欠 ${formatMoney(r.unpaid)}` }
}

export function selectFinanceReceivables(
  cases: Case[],
  caseApplicants: CaseApplicant[],
  plans: PaymentPlan[],
  payments: Pick<Payment, 'case_id' | 'applicant_id' | 'direction' | 'amount' | 'plan_item_id'>[],
  customerById: CustomerMap,
  planItems: Pick<PaymentPlanItem, 'id' | 'plan_id' | 'amount_due' | 'fee_category' | 'created_at' | 'periods'>[] = [],
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
    unitPayments: Pick<Payment, 'direction' | 'amount' | 'plan_item_id'>[],
  ): ReceivableRow => {
    const plan = planFor(c.id, applicantId)
    // 应收/已付/未付一律从款项明细(items)派生（client_total 列保留但不再读）
    const items = plan ? planItems.filter((i) => i.plan_id === plan.id) : []
    const totals = getCaseTotals(items, unitPayments)
    const linkId = applicantId ?? c.customer_id
    // 各阶段只读汇总（行级 = Σ stages，口径不变）；created_at 升序，缺失退到 id 稳定排序
    const stages: StageSummary[] = items
      .slice()
      .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? '') || a.id.localeCompare(b.id))
      .map((it) => {
        const paid = getItemPaid(it.id, unitPayments)
        const periods = it.periods >= 1 ? it.periods : 1
        return {
          stageId: it.id,
          name: it.fee_category,
          periods,
          unitAmount: stageUnitAmount({ amount_due: num(it.amount_due), periods }),
          receivable: num(it.amount_due),
          paid,
          unpaid: round2(Math.max(0, num(it.amount_due) - paid)),
        }
      })
    return {
      caseId: c.id,
      applicantId,
      role,
      coApplicantNames,
      planId: plan?.id ?? null,
      customerId: linkId,
      customerName: customerById[linkId]?.full_name ?? '',
      visaSubclass: c.visa_subclass,
      receivable: totals.totalDue,
      paid: totals.totalPaid,
      unpaid: round2(Math.max(0, totals.totalUnpaid)),
      staged: plan?.staged_billing ?? false,
      stages,
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

// ── 客户名按应收状态着色（纯展示）────────────────────────────────────────
export type CustomerPaymentColor = 'green' | 'blue' | 'default'

/**
 * 根据某客户·案件行的应收/已付/未付，决定客户名显示颜色：
 *   未付 > 0（还欠钱）            → 'blue'
 *   未付 = 0 且 应收 > 0（全付清） → 'green'
 *   应收 = 0（未立案/未收费）       → 'default'（不上色）
 * （paid 入参为完整签名保留，判定以 receivable/outstanding 为准。）
 */
export function getCustomerPaymentColor(
  receivable: number,
  _paid: number,
  outstanding: number,
): CustomerPaymentColor {
  if (outstanding > 0) return 'blue'
  if (receivable > 0) return 'green'
  return 'default'
}

/** Tailwind 文本色类；default = 空串（沿用各处现有颜色）。 */
export const CUSTOMER_PAYMENT_TEXT_CLASS: Record<CustomerPaymentColor, string> = {
  green: 'text-green-600',
  blue: 'text-blue-600',
  default: '',
}

/** 把应收行按 caseId 聚合（同案主+副合计）→ 每个案件的客户名颜色。用于收款明细等按案件着色。 */
export function selectCasePaymentColors(rows: ReceivableRow[]): Record<string, CustomerPaymentColor> {
  const agg = new Map<string, { receivable: number; paid: number; outstanding: number }>()
  for (const r of rows) {
    const e = agg.get(r.caseId) ?? { receivable: 0, paid: 0, outstanding: 0 }
    e.receivable += r.receivable
    e.paid += r.paid
    e.outstanding += r.unpaid
    agg.set(r.caseId, e)
  }
  const out: Record<string, CustomerPaymentColor> = {}
  for (const [caseId, v] of agg) out[caseId] = getCustomerPaymentColor(v.receivable, v.paid, v.outstanding)
  return out
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
  /** 显示名 = 实际付款方(from_client_customer_id)，为空回落案件主申 */
  customerName: string
  /** 案件主申 id：发票上传路径用（与案件绑定，不随付款方变） */
  customerId: string
  /** 名字链接目标 = 付款方档案（from_client_customer_id ?? 案件主申） */
  payerId: string
  /** 原始付款方字段（编辑回填用；为空表示回落主申） */
  fromClientCustomerId: string | null
  visaSubclass: string
  /** 这笔收款对应的案件编号（发票与案件编号绑定用） */
  caseNumber: string
  paidAt: string | null
  note: string | null
  /** 费用类别（律师费 / 文案费 / 其他手填）；未填为 null */
  feeCategory: string | null
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
    const caseCustomerId = c?.customer_id ?? ''
    // 显示归属：实际付款方(from_client) > 账单归属申请人(applicant_id) > 案件主申。
    // 副申自己的账（applicant_id=副申）即使没单独填付款方，也显示副申，不再误挂主申。
    const payerId = p.from_client_customer_id ?? p.applicant_id ?? caseCustomerId
    const payerName = customerById[payerId]?.full_name ?? customerById[caseCustomerId]?.full_name ?? ''
    total += Math.max(0, num(p.amount))
    items.push({
      paymentId: p.id,
      amount: num(p.amount),
      method: p.method,
      customerName: payerName,
      customerId: caseCustomerId,
      payerId,
      fromClientCustomerId: p.from_client_customer_id ?? null,
      visaSubclass: c?.visa_subclass ?? '',
      caseNumber: c?.case_number ?? '',
      paidAt: p.paid_at,
      note: p.note,
      feeCategory: p.fee_category,
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
    // 账单归属申请人优先（副申自己的账显示副申），回落案件主申
    const ownerId = p.applicant_id ?? c?.customer_id
    const customer = ownerId ? customerById[ownerId] : undefined
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
  planItems: PaymentPlanItem[] = [],
): CustomerFinance {
  // 该客户作为主申的案件（家庭账单挂在主申名下管理）
  const myCases = cases.filter((c) => c.customer_id === customerId)
  const myCaseIds = new Set(myCases.map((c) => c.id))
  const caseById: CaseMap = Object.fromEntries(myCases.map((c) => [c.id, c]))
  const myApplicants = caseApplicants.filter((a) => myCaseIds.has(a.case_id))
  const myPlans = plans.filter((p) => myCaseIds.has(p.case_id))
  const myPlanIds = new Set(myPlans.map((p) => p.id))
  const myPlanItems = planItems.filter((i) => myPlanIds.has(i.plan_id))
  const myPayments = payments.filter((p) => myCaseIds.has(p.case_id))
  const receivables = selectFinanceReceivables(myCases, myApplicants, myPlans, myPayments, customerById, myPlanItems)
  return {
    receivables,
    receivableTotals: sumFinanceReceivables(receivables),
    receipts: selectFinanceReceipts(myPayments, caseById, customerById),
    payouts: selectFinancePayouts(myPayments, caseById, customerById, referrerById),
  }
}

// ── 月度账目「合并流水」：收入(收款) + 支出(付主代理/付介绍人) 合并成一张按日期排序的表 ──
// 纯展示派生：不改双流记账，只把现有 receipts/payouts 合并、排序、按视图筛选。
export type LedgerView = 'all' | 'income' | 'expense'

export type LedgerRow =
  | { kind: 'receipt'; id: string; date: string | null; item: ReceiptItem }
  | { kind: 'payout'; id: string; date: string | null; item: PayoutItem }

/** 合并收/支为一张流水：按日期倒序（最新在前），无日期排最后，同日按 id 稳定。 */
export function selectLedgerRows(receipts: FinanceReceipts, payouts: FinancePayouts): LedgerRow[] {
  const rows: LedgerRow[] = [
    ...receipts.items.map((item): LedgerRow => ({ kind: 'receipt', id: item.paymentId, date: item.paidAt, item })),
    ...payouts.items.map((item): LedgerRow => ({ kind: 'payout', id: item.paymentId, date: item.paidAt, item })),
  ]
  return rows.sort((a, b) => {
    if (a.date && b.date) return b.date.localeCompare(a.date) || a.id.localeCompare(b.id)
    if (a.date) return -1
    if (b.date) return 1
    return a.id.localeCompare(b.id)
  })
}

/** 全部 / 收入(收款) / 支出(付主代理+付介绍人) 过滤。 */
export function filterLedgerRows(rows: LedgerRow[], view: LedgerView): LedgerRow[] {
  if (view === 'income') return rows.filter((r) => r.kind === 'receipt')
  if (view === 'expense') return rows.filter((r) => r.kind === 'payout')
  return rows
}

/** 合并表笔数统计：总 / 收入 / 支出（供表头「共 N 笔(收入 X · 支出 Y)」用）。 */
export function ledgerCounts(rows: LedgerRow[]): { total: number; income: number; expense: number } {
  let income = 0
  for (const r of rows) if (r.kind === 'receipt') income++
  return { total: rows.length, income, expense: rows.length - income }
}
