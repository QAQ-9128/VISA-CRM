import { getItemPaid, isPayableItem } from './planItems'
import { PAYMENT_METHOD_LABELS } from '../types/domain'
import type { PaymentMethod } from '../types/domain'
import type { Installment, Payment, PaymentPlanItem } from '../types/models'

const num = (v: number | string | null | undefined): number => {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}
const round2 = (n: number): number => Math.round(n * 100) / 100

// ── 收费项目状态（按已收 vs 应收派生，不写死）─────────────────
export type PayItemStatusKind = 'settled' | 'partial' | 'notStarted'
export interface PayItemStatus {
  kind: PayItemStatusKind
  label: string
}

/**
 * 收费项目状态：已收≥应收(且应收>0)=已结清；0<已收<应收=分期中；已收=0=未开始。
 * 全部由真实「应收 / 已收」派生，绝不写死。
 */
export function planItemRowStatus(due: number, paid: number): PayItemStatus {
  if (due > 0 && paid >= due) return { kind: 'settled', label: '已结清' }
  if (paid > 0) return { kind: 'partial', label: '分期中' }
  return { kind: 'notStarted', label: '未开始' }
}

// ── 收费项目行 ───────────────────────────────────────────────
export interface PaymentItemRow {
  id: string
  name: string
  due: number
  paid: number
  unpaid: number
  periods: number
  status: PayItemStatus
}

/** 每个 payment_plan_item 一行：应收(amount_due)/已收(归属它的 from_client 收款)/未收/状态。 */
export function selectPaymentItemRows(
  items: Pick<PaymentPlanItem, 'id' | 'fee_category' | 'amount_due' | 'periods' | 'kind'>[],
  payments: Pick<Payment, 'plan_item_id' | 'direction' | 'amount'>[],
): PaymentItemRow[] {
  // 应收收费项目表：排除应付款项(payable)——它们走支出区两步流程，不属应收
  return items.filter((it) => !isPayableItem(it)).map((it) => {
    const due = round2(num(it.amount_due))
    const paid = getItemPaid(it.id, payments)
    return {
      id: it.id,
      name: it.fee_category,
      due,
      paid,
      unpaid: Math.max(0, round2(due - paid)),
      periods: it.periods ?? 1,
      status: planItemRowStatus(due, paid),
    }
  })
}

export interface PaymentTotals {
  due: number
  paid: number
  unpaid: number
}

/** 合计行：各项 应收 / 已收 求和，未收 = 应收 − 已收（不夹负，展示用）。 */
export function sumPaymentItemRows(rows: PaymentItemRow[]): PaymentTotals {
  let due = 0
  let paid = 0
  for (const r of rows) {
    due += r.due
    paid += r.paid
  }
  return { due: round2(due), paid: round2(paid), unpaid: Math.max(0, round2(due - paid)) }
}

// ── 最近收款记录 ─────────────────────────────────────────────
export interface RecentReceiptRow {
  id: string
  date: string | null
  amount: number
  method: PaymentMethod
  methodLabel: string
  /** 挂到哪个收费项目（款项类别）；未归类则用 payment.fee_category；都没有 = null */
  itemName: string | null
  /** 挂到第几期分期（label 或到期日）；未挂分期 = null */
  installmentLabel: string | null
}

/** 该案件最近几条 from_client 收款，按收款日期倒序，映射到所属款项 / 分期（仅真实关联）。 */
export function selectRecentReceipts(
  payments: Payment[],
  items: Pick<PaymentPlanItem, 'id' | 'fee_category'>[],
  installments: Pick<Installment, 'id' | 'label' | 'due_date'>[],
  limit = 5,
): RecentReceiptRow[] {
  const nameById = new Map(items.map((i) => [i.id, i.fee_category]))
  const instById = new Map(
    installments.map((i) => [i.id, i.label || (i.due_date ? `到期 ${i.due_date}` : '分期')]),
  )
  return payments
    .filter((p) => p.direction === 'from_client')
    .slice()
    .sort(
      (a, b) =>
        (b.paid_at ?? '').localeCompare(a.paid_at ?? '') ||
        (b.created_at ?? '').localeCompare(a.created_at ?? ''),
    )
    .slice(0, limit)
    .map((p) => ({
      id: p.id,
      date: p.paid_at,
      amount: num(p.amount),
      method: p.method,
      methodLabel: PAYMENT_METHOD_LABELS[p.method],
      itemName: (p.plan_item_id ? nameById.get(p.plan_item_id) : null) ?? p.fee_category ?? null,
      installmentLabel: p.installment_id ? (instById.get(p.installment_id) ?? null) : null,
    }))
}

// ── 导出付款计划（CSV）──────────────────────────────────────
function csvCell(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** 收费项目表导出为 CSV（含合计行）；金额为原始数字，由调用方决定文件名 / 币种展示。 */
export function paymentItemsCsv(rows: PaymentItemRow[]): string {
  const totals = sumPaymentItemRows(rows)
  const head = ['项目', '应收', '已收', '未收', '状态']
  const body = rows.map((r) => [r.name, r.due, r.paid, r.unpaid, r.status.label])
  body.push(['合计', totals.due, totals.paid, totals.unpaid, ''])
  return [head, ...body].map((cols) => cols.map(csvCell).join(',')).join('\n')
}
