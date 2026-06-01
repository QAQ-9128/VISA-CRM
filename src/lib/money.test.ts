import { describe, expect, it } from 'vitest'
import { formatMoney, formatAmount } from './money'

describe('formatMoney（带币种，绝对金额用）', () => {
  it('默认 AUD + 千分位 + 2 位小数', () => {
    expect(formatMoney(1200)).toBe('AUD 1,200.00')
  })
  it('自定义币种', () => {
    expect(formatMoney(1200, 'USD')).toBe('USD 1,200.00')
  })
  it('空/非法 → 0', () => {
    expect(formatMoney(null)).toBe('AUD 0.00')
  })
})

describe('formatAmount（无币种，分数/比例用，对齐 receivableCells.fmt）', () => {
  it('千分位 + 固定 2 位小数', () => {
    expect(formatAmount(1200)).toBe('1,200.00')
    expect(formatAmount(1234567.5)).toBe('1,234,567.50')
  })
  it('0', () => {
    expect(formatAmount(0)).toBe('0.00')
  })
  it('负数（超付等）', () => {
    expect(formatAmount(-50)).toBe('-50.00')
  })
  it('字符串/空/非法 → 数值化，空→0', () => {
    expect(formatAmount('1200')).toBe('1,200.00')
    expect(formatAmount(null)).toBe('0.00')
    expect(formatAmount(undefined)).toBe('0.00')
  })
  it('与 formatMoney 同口径（仅差币种前缀）', () => {
    expect(`AUD ${formatAmount(85000)}`).toBe(formatMoney(85000))
  })
})
