/** 金额展示：`AUD 1,200.00`。兼容 numeric 返回的字符串。 */
export function formatMoney(amount: number | string | null | undefined, currency = 'AUD'): string {
  const n = Number(amount ?? 0)
  const safe = Number.isFinite(n) ? n : 0
  return `${currency} ${safe.toLocaleString('en-AU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}
