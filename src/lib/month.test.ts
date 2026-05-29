import { describe, expect, it } from 'vitest'
import { currentMonth, shiftMonth, monthLabel } from './month'

describe('currentMonth', () => {
  it('返回本地年月 YYYY-MM（补零）', () => {
    expect(currentMonth(new Date(2026, 0, 9))).toBe('2026-01')
    expect(currentMonth(new Date(2026, 11, 31))).toBe('2026-12')
  })
})

describe('shiftMonth', () => {
  it('前后偏移，跨年正确', () => {
    expect(shiftMonth('2026-05', 1)).toBe('2026-06')
    expect(shiftMonth('2026-05', -1)).toBe('2026-04')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01') // 跨年向前
    expect(shiftMonth('2026-01', -1)).toBe('2025-12') // 跨年向后
    expect(shiftMonth('2026-05', 0)).toBe('2026-05')
    expect(shiftMonth('2026-03', -14)).toBe('2025-01') // 多月跨年
  })
})

describe('monthLabel', () => {
  it('YYYY-MM → 中文年月（不补零）', () => {
    expect(monthLabel('2026-05')).toBe('2026 年 5 月')
    expect(monthLabel('2026-12')).toBe('2026 年 12 月')
  })
})
