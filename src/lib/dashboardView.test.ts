import { describe, expect, it } from 'vitest'
import { displayCustomerName, pickGreetingName, showReceiptsTrend } from './dashboardView'

describe('pickGreetingName（问候语绝不外显邮箱）', () => {
  it('有真实姓名 → 返回姓名', () => {
    expect(pickGreetingName('张三')).toBe('张三')
  })
  it('姓名两端空白 → trim 后返回', () => {
    expect(pickGreetingName('  李四  ')).toBe('李四')
  })
  it('无姓名（null/空/纯空白）→ 返回 null，不回落邮箱', () => {
    expect(pickGreetingName(null)).toBeNull()
    expect(pickGreetingName(undefined)).toBeNull()
    expect(pickGreetingName('')).toBeNull()
    expect(pickGreetingName('   ')).toBeNull()
  })
  it('full_name 实为邮箱（含 @）→ 视为无名，返回 null', () => {
    expect(pickGreetingName('1535759562@qq.com')).toBeNull()
    expect(pickGreetingName('  amy@example.com ')).toBeNull()
  })
})

describe('showReceiptsTrend（0 值/无意义不显示趋势 chip）', () => {
  const mk = (pct: number | null, dir: 'up' | 'down' | 'flat'): { pct: number | null; dir: 'up' | 'down' | 'flat' } => ({ pct, dir })
  it('当前值 > 0 且有真实涨跌 → 显示', () => {
    expect(showReceiptsTrend(48600, mk(8.2, 'up'))).toBe(true)
    expect(showReceiptsTrend(100, mk(20, 'down'))).toBe(true)
  })
  it('当前值为 0 → 不显示（杜绝 AUD 0.00 的「↓100%」）', () => {
    expect(showReceiptsTrend(0, mk(100, 'down'))).toBe(false)
  })
  it('上月为 0（pct=null）→ 不显示', () => {
    expect(showReceiptsTrend(5000, mk(null, 'up'))).toBe(false)
  })
  it('持平 → 不显示', () => {
    expect(showReceiptsTrend(5000, mk(0, 'flat'))).toBe(false)
  })
})

describe('displayCustomerName（无名兜底）', () => {
  it('有名字 → 原样（trim）', () => {
    expect(displayCustomerName('王五')).toBe('王五')
    expect(displayCustomerName('  赵六 ')).toBe('赵六')
  })
  it('空白名 → 未命名', () => {
    expect(displayCustomerName(null)).toBe('未命名')
    expect(displayCustomerName(undefined)).toBe('未命名')
    expect(displayCustomerName('')).toBe('未命名')
    expect(displayCustomerName('   ')).toBe('未命名')
  })
  it('空名可传更有意义的兜底（签证 / 案件号）', () => {
    expect(displayCustomerName('', '482 · 案件')).toBe('482 · 案件')
    expect(displayCustomerName(null, 'C0001')).toBe('C0001')
    expect(displayCustomerName('王五', 'C0001')).toBe('王五')
  })
})
