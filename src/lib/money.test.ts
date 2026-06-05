import { describe, expect, it } from 'vitest'
import { formatMoney, formatAmount, formatMoneyShort } from './money'

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
  it('会被四舍五入成 0 的极小负值 → 归整为 0，不显示负零 "-0.00"', () => {
    expect(formatAmount(-0.001)).toBe('0.00')
    expect(formatAmount(-0.0049)).toBe('0.00')
    expect(formatAmount(-0)).toBe('0.00')
    expect(formatMoney(-0.001)).toBe('AUD 0.00')
    // 真实负金额不受影响
    expect(formatMoney(-0.01)).toBe('AUD -0.01')
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

describe('formatMoneyShort（统计卡缩写）', () => {
  it('千位用 k、保留一位小数', () => {
    expect(formatMoneyShort(48600)).toBe('AUD 48.6k')
    expect(formatMoneyShort(21400)).toBe('AUD 21.4k')
  })
  it('整千去尾零', () => {
    expect(formatMoneyShort(1000)).toBe('AUD 1k')
  })
  it('百万用 m', () => {
    expect(formatMoneyShort(2_500_000)).toBe('AUD 2.5m')
  })
  it('小于 1000 回落完整金额', () => {
    expect(formatMoneyShort(500)).toBe('AUD 500.00')
    expect(formatMoneyShort(0)).toBe('AUD 0.00')
  })
  it('负数带符号', () => {
    expect(formatMoneyShort(-21400)).toBe('AUD -21.4k')
  })
  it('字符串数值可强转', () => {
    expect(formatMoneyShort('48600')).toBe('AUD 48.6k')
  })
})
