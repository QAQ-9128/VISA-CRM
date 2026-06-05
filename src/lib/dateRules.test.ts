import { describe, expect, it } from 'vitest'
import { todayYmd, isFutureYmd, isPastYmd } from './dateRules'

describe('dateRules（阶段日期禁未来 / 待办截止禁过去）', () => {
  it('todayYmd：本地日历日补零', () => {
    expect(todayYmd(new Date(2026, 5, 5))).toBe('2026-06-05')
    expect(todayYmd(new Date(2026, 0, 9))).toBe('2026-01-09')
  })
  it('isFutureYmd：明天 true、今天/昨天 false、空值 false', () => {
    expect(isFutureYmd('2026-06-06', '2026-06-05')).toBe(true)
    expect(isFutureYmd('2026-06-05', '2026-06-05')).toBe(false)
    expect(isFutureYmd('2026-06-04', '2026-06-05')).toBe(false)
    expect(isFutureYmd(null, '2026-06-05')).toBe(false)
    expect(isFutureYmd('', '2026-06-05')).toBe(false)
  })
  it('isPastYmd：昨天 true、今天/明天 false、空值 false', () => {
    expect(isPastYmd('2026-06-04', '2026-06-05')).toBe(true)
    expect(isPastYmd('2026-06-05', '2026-06-05')).toBe(false)
    expect(isPastYmd('2026-06-06', '2026-06-05')).toBe(false)
    expect(isPastYmd(undefined, '2026-06-05')).toBe(false)
  })
})
