import { describe, expect, it } from 'vitest'
import { utcDayDiff } from './dateDiff'

describe('utcDayDiff', () => {
  it('计算整天数 (to - from)', () => {
    expect(utcDayDiff('2026-01-01', '2026-01-31')).toBe(30)
    expect(utcDayDiff('2026-01-31', '2026-01-01')).toBe(-30)
    expect(utcDayDiff('2026-01-01', '2026-01-01')).toBe(0)
  })

  it('跨夏令时月份也准确（用 UTC，不受本地 DST 影响）', () => {
    // 2025-09-13 → 2026-01-01 = 110 天
    expect(utcDayDiff('2025-09-13', '2026-01-01')).toBe(110)
  })

  it('支持 Date 入参', () => {
    expect(utcDayDiff(new Date(2026, 0, 1), '2026-01-11')).toBe(10)
  })
})
