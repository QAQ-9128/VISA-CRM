import { EXPENSE_DIRECTIONS } from '../types/domain'
import type { Payment } from '../types/models'

/**
 * 案件支出区（费用记录卡）纯派生：本案三类实付支出（付主代理 / 付介绍人 / 垫付杂项）。
 * 与月度账目同口径：负数（冲红）明细保留、合计夹 0 不抵减；金额兼容 numeric 字符串。
 * 只记实付流水，无应付/欠款概念（2026-06-07 拍板）。
 */

type AmountLike = number | string | null | undefined
const num = (v: AmountLike): number => {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}
const round2 = (n: number): number => Math.round(n * 100) / 100

export interface CaseExpenseTotals {
  toCompany: number
  toReferrer: number
  misc: number
  total: number
}

export interface CaseExpenses {
  /** 支出明细：日期倒序（无日期排最后，同日按 id 稳定） */
  items: Payment[]
  totals: CaseExpenseTotals
}

export function selectCaseExpenses(payments: Payment[]): CaseExpenses {
  const expenseSet = new Set<string>(EXPENSE_DIRECTIONS)
  const items = payments
    .filter((p) => expenseSet.has(p.direction))
    .sort((a, b) => {
      if (a.paid_at && b.paid_at) return b.paid_at.localeCompare(a.paid_at) || a.id.localeCompare(b.id)
      if (a.paid_at) return -1
      if (b.paid_at) return 1
      return a.id.localeCompare(b.id)
    })
  let toCompany = 0
  let toReferrer = 0
  let misc = 0
  for (const p of items) {
    const positive = Math.max(0, num(p.amount))
    if (p.direction === 'to_company') toCompany += positive
    else if (p.direction === 'to_referrer') toReferrer += positive
    else misc += positive
  }
  return {
    items,
    totals: {
      toCompany: round2(toCompany),
      toReferrer: round2(toReferrer),
      misc: round2(misc),
      total: round2(toCompany + toReferrer + misc),
    },
  }
}
