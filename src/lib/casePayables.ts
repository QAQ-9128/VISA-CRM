import { receivableStatus } from './finance'
import { getPayableItemPaid, isPayableItem } from './planItems'
import type { FeeLineStatus } from './caseFees'
import type { Payment, PaymentPlanItem } from '../types/models'

/**
 * 「本案支出」**应付款项**两步派生（镜像应收侧 caseFees）：
 *   款项(kind='payable', amount_due=应付) → 记一笔实际支出(payments: to_company/to_referrer, plan_item_id 关联)。
 * 状态「待付款/已付」由 应付 vs 已付 派生（复用 receivableStatus 的 unset/settled/owing 三态）。
 * 垫付杂项(misc) 不走两步、不计入此处；净额仍由 payments 实付重算（本派生只供状态/小计展示）。
 */

type AmountLike = number | string | null | undefined
const num = (v: AmountLike): number => {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}
const round2 = (n: number): number => Math.round(n * 100) / 100

export interface CasePayableLine {
  itemId: string
  /** 款项类型（如 提名代理费） */
  label: string
  /** 应付金额 */
  amount: number
  /** 已付 = 归属它的 to_company + to_referrer 实付之和 */
  paid: number
  /** 待付 = 应付 − 已付（≥0） */
  unpaid: number
  /** 待付款 owing / 已付 settled / 未设应付 unset */
  status: FeeLineStatus
}

export interface CasePayables {
  lines: CasePayableLine[]
  totals: { payable: number; paid: number; unpaid: number }
}

export function selectCasePayables(
  items: Pick<PaymentPlanItem, 'id' | 'fee_category' | 'amount_due' | 'kind' | 'created_at'>[],
  payments: Pick<Payment, 'plan_item_id' | 'direction' | 'amount'>[],
): CasePayables {
  const payableItems = items
    .filter(isPayableItem)
    .slice()
    .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? '') || a.id.localeCompare(b.id))

  const lines: CasePayableLine[] = payableItems.map((it) => {
    const amount = num(it.amount_due)
    const paid = getPayableItemPaid(it.id, payments)
    const unpaid = round2(Math.max(0, amount - paid))
    return {
      itemId: it.id,
      label: it.fee_category,
      amount,
      paid,
      unpaid,
      status: receivableStatus({ receivable: amount, unpaid }).kind,
    }
  })

  return {
    lines,
    totals: {
      payable: round2(lines.reduce((s, l) => s + l.amount, 0)),
      paid: round2(lines.reduce((s, l) => s + l.paid, 0)),
      unpaid: round2(lines.reduce((s, l) => s + l.unpaid, 0)),
    },
  }
}
