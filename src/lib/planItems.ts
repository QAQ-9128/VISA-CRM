import type { Payment, PaymentPlanItem } from '../types/models'

/**
 * 款项明细（payment_plan_items）派生：每条款项独立 应收(amount_due)/已付/未付。
 * 已付 = 归属该款项的 from_client 收款之和；未归类(plan_item_id=null)的收款不计入任何款项。
 * 金额兼容 numeric 返回的字符串。
 */
type AmountLike = number | string | null | undefined
const num = (v: AmountLike): number => {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}
const round2 = (n: number): number => Math.round(n * 100) / 100

type PaymentLike = Pick<Payment, 'plan_item_id' | 'direction' | 'amount'>
type ItemLike = Pick<PaymentPlanItem, 'id' | 'amount_due'>

/** 应付款项（kind='payable'）：付主代理/付介绍人的欠付义务。应收聚合一律排除它。 */
export function isPayableItem(item: { kind?: string | null }): boolean {
  return item.kind === 'payable'
}

/** 该款项名下已付：归属它的 from_client 收款求和。 */
export function getItemPaid(itemId: string, payments: PaymentLike[]): number {
  let sum = 0
  for (const p of payments) {
    if (p.plan_item_id !== itemId) continue
    if (p.direction !== 'from_client') continue
    sum += num(p.amount)
  }
  return round2(sum)
}

/** 该款项未付 = 应收 − 已付（可为负，超付时；不夹 0，由展示层决定）。 */
export function getItemUnpaid(item: ItemLike, payments: PaymentLike[]): number {
  return round2(num(item.amount_due) - getItemPaid(item.id, payments))
}

export interface CaseTotals {
  totalDue: number
  totalPaid: number
  totalUnpaid: number
}

/** 案件级汇总：各款项 应收/已付 求和，未付 = 总应收 − 总已付。 */
export function getCaseTotals(items: ItemLike[], payments: PaymentLike[]): CaseTotals {
  let totalDue = 0
  let totalPaid = 0
  for (const it of items) {
    totalDue += num(it.amount_due)
    totalPaid += getItemPaid(it.id, payments)
  }
  return {
    totalDue: round2(totalDue),
    totalPaid: round2(totalPaid),
    totalUnpaid: round2(totalDue - totalPaid),
  }
}

/** 删除守卫：该款项名下是否已有收款（有则禁止删除）。 */
export function itemHasPayments(itemId: string, payments: Pick<Payment, 'plan_item_id'>[]): boolean {
  return payments.some((p) => p.plan_item_id === itemId)
}
