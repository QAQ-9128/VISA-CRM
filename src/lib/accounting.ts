import { utcDayDiff } from './dateDiff'
import type { PaymentDirection } from '../types/domain'

type AmountLike = number | string | null | undefined

const num = (v: AmountLike): number => {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}
const round2 = (n: number): number => Math.round(n * 100) / 100

export interface Accounting {
  /** 客户已付（Σ from_client） */
  clientPaid: number
  /** 客户还欠 = client_total − 客户已付 */
  clientOwes: number
  /** 已付主代理（Σ to_company） */
  companyPaid: number
  /** 还差主代理 = company_total − 已付主代理 */
  companyOwes: number
}

/**
 * 双流账目计算（前端，不入库；金额兼容 numeric 返回的字符串）。
 */
export function computeAccounting(
  plan: { client_total: AmountLike; company_total: AmountLike } | null | undefined,
  payments: { direction: PaymentDirection; amount: AmountLike }[],
): Accounting {
  const sumOf = (dir: PaymentDirection) =>
    round2(payments.filter((p) => p.direction === dir).reduce((acc, p) => acc + num(p.amount), 0))

  const clientPaid = sumOf('from_client')
  const companyPaid = sumOf('to_company')

  return {
    clientPaid,
    clientOwes: round2(num(plan?.client_total) - clientPaid),
    companyPaid,
    companyOwes: round2(num(plan?.company_total) - companyPaid),
  }
}

/** 分期是否逾期未付（沿用 UTC 天数算法，DST 安全）。 */
export function isInstallmentOverdue(
  dueDate: string | null,
  isPaid: boolean,
  today: Date = new Date(),
): boolean {
  if (isPaid || !dueDate) return false
  return utcDayDiff(today, dueDate) < 0
}
