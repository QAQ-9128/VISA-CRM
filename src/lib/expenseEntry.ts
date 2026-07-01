import type { PaymentInsert, PaymentPlanItemInsert } from '../api/payments'
import type { Payment, PaymentPlanItem } from '../types/models'
import type { PaymentMethod } from '../types/domain'

/**
 * 「本案支出 · 列式录入（百分比预实版）」纯逻辑层（2026-06）。
 *
 * 一行一笔，列 = 付款对象 / 方式 / 描述 / 金额 / 百分比 / 实付。映射到**现有**双流模型，算法零改动：
 *   - 实际支出 = payments(direction=付款对象 to_company/to_referrer)，amount=**实付**（计入净额，口径不变）；
 *   - 预支出   = payment_plan_items(kind='payable', expense_direction=付款对象)，无 payment → 天然不进净额。
 * ★入账的是「实付」★：实付 = 金额 × 百分比；百分比留空 = 100%（实付 = 金额）。to_company/to_referrer 写入的、
 * 参与净额的都是算出的实付，不是基数。预/实流转 = payable 行 ↔ payment 行互转，computeAccounting 不动。
 */

/** 支出付款对象（列式两项；显示名「付给公司/付给介绍人」，底层 direction 不变）。 */
export const EXPENSE_PARTIES = ['to_company', 'to_referrer'] as const
export type ExpenseParty = (typeof EXPENSE_PARTIES)[number]
export const EXPENSE_PARTY_LABELS: Record<ExpenseParty, string> = {
  to_company: '付给公司',
  to_referrer: '付给介绍人',
}

/** 支出方式：转账 / 现金 / 垫付。 */
export const EXPENSE_METHODS: PaymentMethod[] = ['transfer', 'cash', 'advance']

export interface DraftExpenseLine {
  key: string
  party: ExpenseParty | ''
  method: PaymentMethod | ''
  /** 金额（基数） */
  amount: string
  /** 百分比，留空 = 100% */
  percent: string
}

let seq = 0
export const emptyExpenseDraft = (): DraftExpenseLine => ({
  key: `e${seq++}`, party: '', method: '', amount: '', percent: '',
})

const num = (v: string): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
const round2 = (n: number): number => Math.round(n * 100) / 100

/** ★实付 = 金额 × 百分比；百分比留空/非法 → 100%（实付 = 金额）。 */
export function actualAmount(amount: string, percent: string): number {
  const base = num(amount)
  const p = percent.trim()
  if (p === '') return round2(base)
  const pct = Number(p)
  if (!Number.isFinite(pct)) return round2(base)
  return round2((base * pct) / 100)
}

/** 算式展示：有百分比 → "100×30%"；留空 → "100%"。 */
export function actualFormula(amount: string, percent: string): string {
  const p = percent.trim()
  if (p === '') return '100%'
  return `${num(amount)}×${p}%`
}

/** 整行空白 → 保存时跳过，不算非法。 */
export const isExpenseDraftBlank = (d: DraftExpenseLine): boolean =>
  d.party === '' && d.method === '' && d.amount.trim() === '' && d.percent.trim() === ''

/** 合法行：付款对象 + 方式 + 金额>0（百分比选填）。 */
export const isExpenseDraftValid = (d: DraftExpenseLine): boolean =>
  (d.party === 'to_company' || d.party === 'to_referrer') &&
  d.method !== '' &&
  num(d.amount) > 0

export interface ExpenseDraftValidation {
  ready: DraftExpenseLine[]
  ok: boolean
  error: string | null
}

export function validateExpenseDrafts(rows: DraftExpenseLine[]): ExpenseDraftValidation {
  const nonBlank = rows.filter((r) => !isExpenseDraftBlank(r))
  const ready = nonBlank.filter(isExpenseDraftValid)
  if (nonBlank.length === 0) return { ready: [], ok: false, error: null }
  if (nonBlank.some((r) => !isExpenseDraftValid(r)))
    return { ready, ok: false, error: '请为每行选择付款对象、方式，金额需大于 0' }
  return { ready, ok: true, error: null }
}

/** 草稿 → 实际支出 payment（amount=实付）。案件级支出：applicant_id/plan_item_id = null。无描述列 → note 恒 null。 */
export function draftToExpensePayment(
  d: DraftExpenseLine,
  ctx: { caseId: string; currency: string; paidAt: string },
): PaymentInsert {
  return {
    case_id: ctx.caseId,
    applicant_id: null,
    direction: d.party as ExpenseParty,
    plan_item_id: null,
    amount: actualAmount(d.amount, d.percent),
    currency: ctx.currency,
    method: (d.method || 'transfer') as PaymentMethod,
    paid_at: ctx.paidAt,
    note: null,
  }
}

/** 实际支出 payment → 预支出 payable 款项（改回预支出用）。携带付款对象、实付金额、描述。 */
export function paymentToPayableItem(payment: Payment, planId: string): PaymentPlanItemInsert {
  return {
    plan_id: planId,
    kind: 'payable',
    expense_direction: payment.direction,
    fee_category: payment.note ?? '支出',
    amount_due: Number(payment.amount),
  }
}

/** 预支出 payable 款项 → 实际支出 payment（记支出转实际用）。金额=应付实付，付款对象=expense_direction。 */
export function payableItemToPayment(
  item: PaymentPlanItem,
  ctx: { caseId: string; currency: string; paidAt: string; method?: PaymentMethod },
): PaymentInsert {
  return {
    case_id: ctx.caseId,
    applicant_id: null,
    direction: (item.expense_direction ?? 'to_company') as ExpenseParty,
    plan_item_id: null,
    amount: Number(item.amount_due),
    currency: ctx.currency,
    method: ctx.method ?? 'transfer',
    paid_at: ctx.paidAt,
    note: item.fee_category,
  }
}
