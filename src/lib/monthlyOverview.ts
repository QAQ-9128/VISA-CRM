import { PAYMENT_METHOD_LABELS } from '../types/domain'
import type { PaymentMethod } from '../types/domain'
import type { FinanceReceipts, FinancePayouts, PayoutItem, ReceiptItem } from './finance'

/**
 * 月度账目总览（mockup「双流总览」页）的纯展示派生。
 * 不重新求和：income/toCompany/toReferrer 直接引用现有 selectFinanceReceipts /
 * selectFinancePayouts 的合计输出，这里只做双流恒等式算术（净额 = 收入 − 支出）与格式化。
 */

const round2 = (n: number): number => Math.round(n * 100) / 100

export interface MonthlyOverview {
  /** 收入小计 = receipts.total（Σ from_client） */
  income: number
  /** 付主代理合计 = payouts.toCompanyTotal */
  toCompany: number
  /** 付介绍人合计 = payouts.toReferrerTotal */
  toReferrer: number
  /** 支出小计 = toCompany + toReferrer */
  expense: number
  /** 净额 = income − expense（双流恒等） */
  net: number
  /** 较上月：金额差 + 整数百分比（上月净额为 0 时 pct=null）；无上月数据 → null（UI 省略该行） */
  delta: { amount: number; pct: number | null } | null
}

export function selectMonthlyOverview(
  receipts: FinanceReceipts,
  payouts: FinancePayouts,
  prevReceipts?: FinanceReceipts,
  prevPayouts?: FinancePayouts,
): MonthlyOverview {
  const expense = round2(payouts.toCompanyTotal + payouts.toReferrerTotal)
  const net = round2(receipts.total - expense)
  let delta: MonthlyOverview['delta'] = null
  if (prevReceipts && prevPayouts) {
    const prevNet = round2(prevReceipts.total - round2(prevPayouts.toCompanyTotal + prevPayouts.toReferrerTotal))
    const amount = round2(net - prevNet)
    delta = { amount, pct: prevNet === 0 ? null : Math.round((amount / Math.abs(prevNet)) * 100) }
  }
  return {
    income: receipts.total,
    toCompany: payouts.toCompanyTotal,
    toReferrer: payouts.toReferrerTotal,
    expense,
    net,
    delta,
  }
}

/** 支出明细按 direction 分组（付主代理 / 付介绍人），保持 selector 给定的日期倒序。 */
export function groupPayouts(items: PayoutItem[]): { toCompany: PayoutItem[]; toReferrer: PayoutItem[] } {
  return {
    toCompany: items.filter((i) => i.direction === 'to_company'),
    toReferrer: items.filter((i) => i.direction === 'to_referrer'),
  }
}

/** 'YYYY-MM' → '2026年5月'（月份不补零，月份 pill 用）。 */
export function monthTitle(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return `${y}年${m}月`
}

/** 'YYYY-MM-DD' → '5月3日'（行尾日期）；无日期 → '—'。字符串切片，DST 安全。 */
export function formatMonthDay(date: string | null): string {
  if (!date) return '—'
  const [, m, d] = date.split('-').map(Number)
  return `${m}月${d}日`
}

/** 收入行小字：fee_category · note（缺哪个省哪个）；全缺退付款方式标签——全为真实字段。 */
export function receiptSubtitle(i: Pick<ReceiptItem, 'feeCategory' | 'note' | 'method'>): string {
  const parts = [i.feeCategory, i.note].filter(Boolean)
  return parts.length ? parts.join(' · ') : PAYMENT_METHOD_LABELS[i.method as PaymentMethod]
}

/** 支出行小字：note 优先，退付款方式标签。 */
export function payoutSubtitle(i: Pick<PayoutItem, 'note' | 'method'>): string {
  return i.note || PAYMENT_METHOD_LABELS[i.method as PaymentMethod]
}

/** 支出行显示名（收款方）：付主代理=该案客户名；付介绍人=介绍人名（缺失退客户名）。 */
export function payoutDisplayName(i: Pick<PayoutItem, 'direction' | 'customerName' | 'referrerName'>): string {
  if (i.direction === 'to_referrer') return i.referrerName || i.customerName || '（未知）'
  return i.customerName || '（未知）'
}
