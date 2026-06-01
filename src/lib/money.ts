type AmountLike = number | string | null | undefined

const toSafe = (amount: AmountLike): number => {
  const n = Number(amount ?? 0)
  return Number.isFinite(n) ? n : 0
}

/** 纯金额（无币种）：`1,200.00`。给「已付 / 应收」分数、比例等不带币种的场景用。
 *  口径与 formatMoney 一致（千分位 + 固定 2 位小数），仅少了币种前缀。 */
export function formatAmount(amount: AmountLike): string {
  return toSafe(amount).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** 金额展示：`AUD 1,200.00`。兼容 numeric 返回的字符串。 */
export function formatMoney(amount: AmountLike, currency = 'AUD'): string {
  return `${currency} ${formatAmount(amount)}`
}
