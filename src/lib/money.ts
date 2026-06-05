type AmountLike = number | string | null | undefined

const toSafe = (amount: AmountLike): number => {
  const n = Number(amount ?? 0)
  return Number.isFinite(n) ? n : 0
}

/** 纯金额（无币种）：`1,200.00`。给「已付 / 应收」分数、比例等不带币种的场景用。
 *  口径与 formatMoney 一致（千分位 + 固定 2 位小数），仅少了币种前缀。 */
export function formatAmount(amount: AmountLike): string {
  const n = toSafe(amount)
  // 会被四舍五入成 0 的极小值先归整为 0：避免 -0.001 显示成刺眼的负零 "-0.00"
  const v = Math.abs(n) < 0.005 ? 0 : n
  return v.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** 金额展示：`AUD 1,200.00`。兼容 numeric 返回的字符串。 */
export function formatMoney(amount: AmountLike, currency = 'AUD'): string {
  return `${currency} ${formatAmount(amount)}`
}

/**
 * 缩写金额（仅用于统计卡等紧凑展示）：≥1000 用 `k`、≥100万用 `m`，保留 1 位小数（去尾零）；
 * 小于 1000 回落到完整 `formatMoney`。例：48600→`AUD 48.6k`、21400→`AUD 21.4k`、500→`AUD 500.00`。
 */
export function formatMoneyShort(amount: AmountLike, currency = 'AUD'): string {
  const n = toSafe(amount)
  const abs = Math.abs(n)
  if (abs < 1000) return formatMoney(n, currency)
  const div = abs >= 1_000_000 ? 1_000_000 : 1000
  const unit = abs >= 1_000_000 ? 'm' : 'k'
  const v = Math.round((abs / div) * 10) / 10
  return `${currency} ${n < 0 ? '-' : ''}${v}${unit}`
}
