import { describe, expect, it } from 'vitest'
import { todayYmd, isFutureYmd, isPastYmd, auFinancialYear, fyOfEndYear, fyOfMonth, clampMonthToFy } from './dateRules'

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

describe('auFinancialYear（澳洲财年 7/1→次年 6/30，按结束年命名，本地日期）', () => {
  it('财年首日 2025-07-01 落入 2025–26 财年', () => {
    expect(auFinancialYear(new Date(2025, 6, 1))).toEqual({
      endYear: 2026,
      startYmd: '2025-07-01',
      endYmd: '2026-06-30',
      label: '2025–26 财年',
    })
  })
  it('财年末日 2026-06-30 落入 2025–26 财年', () => {
    expect(auFinancialYear(new Date(2026, 5, 30)).label).toBe('2025–26 财年')
  })
  it('本地 6/30 23:00 仍落入 2025–26 财年（本地日历日，不能用 UTC）', () => {
    expect(auFinancialYear(new Date(2026, 5, 30, 23, 0)).endYear).toBe(2026)
  })
  it('7/1 凌晨进入下一财年 2026–27', () => {
    expect(auFinancialYear(new Date(2026, 6, 1, 0, 0)).label).toBe('2026–27 财年')
  })
  it('上半年（1 月）属于上一年开始的财年', () => {
    expect(auFinancialYear(new Date(2026, 0, 15)).label).toBe('2025–26 财年')
  })
})

describe('fyOfMonth（月度→财年联动：YYYY-MM 所属财年）', () => {
  it('7 月起属新财年：2025-07 → 2025–26', () => {
    expect(fyOfMonth('2025-07').label).toBe('2025–26 财年')
    expect(fyOfMonth('2025-12').endYear).toBe(2026)
  })
  it('6 月止属旧财年：2026-06 → 2025–26；2026-07 → 2026–27', () => {
    expect(fyOfMonth('2026-06').endYear).toBe(2026)
    expect(fyOfMonth('2026-07').endYear).toBe(2027)
  })
  it('1 月属上年开始的财年：2026-01 → 2025–26', () => {
    expect(fyOfMonth('2026-01').label).toBe('2025–26 财年')
  })
})

describe('clampMonthToFy（财年→月度联动：把月份夹进财年范围）', () => {
  const fy = fyOfEndYear(2026) // 2025-07 ~ 2026-06
  it('财年内 → 原样', () => {
    expect(clampMonthToFy('2025-07', fy)).toBe('2025-07')
    expect(clampMonthToFy('2026-06', fy)).toBe('2026-06')
    expect(clampMonthToFy('2026-01', fy)).toBe('2026-01')
  })
  it('晚于财年（过去财年场景）→ 财年末月 6 月', () => {
    expect(clampMonthToFy('2026-07', fy)).toBe('2026-06')
    expect(clampMonthToFy('2027-03', fy)).toBe('2026-06')
  })
  it('早于财年（未来财年场景）→ 财年首月 7 月', () => {
    expect(clampMonthToFy('2025-06', fy)).toBe('2025-07')
    expect(clampMonthToFy('2024-01', fy)).toBe('2025-07')
  })
})

describe('fyOfEndYear（‹ › 切上一/下一财年）', () => {
  it('endYear−1 = 上一财年 2024–25', () => {
    expect(fyOfEndYear(2025)).toEqual({
      endYear: 2025,
      startYmd: '2024-07-01',
      endYmd: '2025-06-30',
      label: '2024–25 财年',
    })
  })
  it('endYear+1 = 下一财年 2026–27', () => {
    expect(fyOfEndYear(2027).startYmd).toBe('2026-07-01')
    expect(fyOfEndYear(2027).endYmd).toBe('2027-06-30')
    expect(fyOfEndYear(2027).label).toBe('2026–27 财年')
  })
})
