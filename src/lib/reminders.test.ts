import { describe, expect, it } from 'vitest'
import { addDays, addMonths, firstDueDate, occurrencesInMonth, formatDueCn } from './reminders'

describe('formatDueCn（中文年月日 + 周几，本地）', () => {
  it('2026-06-04 是周四', () => {
    expect(formatDueCn('2026-06-04')).toBe('2026年6月4日(周四)')
  })
  it('2026-06-16 是周二；带时间戳也取本地日部分', () => {
    expect(formatDueCn('2026-06-16')).toBe('2026年6月16日(周二)')
    expect(formatDueCn('2026-06-16T00:00:00Z')).toBe('2026年6月16日(周二)')
  })
})

describe('firstDueDate（创建日 + offset，本地，月末夹取）', () => {
  it('天/月/年 偏移', () => {
    expect(firstDueDate('2026-06-16', 10, 'day')).toBe('2026-06-26')
    expect(firstDueDate('2026-06-16', 2, 'month')).toBe('2026-08-16')
    expect(firstDueDate('2026-06-16', 2, 'year')).toBe('2028-06-16')
  })
  it('月末夹取：1/31 + 1 月 → 2/28', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(firstDueDate('2026-01-31', 1, 'month')).toBe('2026-02-28')
  })
  it('跨 UTC 日界：用本地深夜创建戳取本地日 + offset（不偏移一天）', () => {
    // 本地 2026-06-30 23:00 创建（UTC 已 7/1）→ 本地创建日 2026-06-30，+1 天 = 7/1
    const createdLocal = '2026-06-30' // 前端已用 localYmd 落到本地创建日
    expect(addDays(createdLocal, 1)).toBe('2026-07-01')
  })
})

describe('occurrencesInMonth（重复规则在某月内的到期日）', () => {
  it('永不/自定义 → 仅首次到期（落在该月才出）', () => {
    expect(occurrencesInMonth('2026-06-16', 'never', '2026-06')).toEqual(['2026-06-16'])
    expect(occurrencesInMonth('2026-06-16', 'never', '2026-07')).toEqual([]) // 不在该月
    expect(occurrencesInMonth('2026-06-16', 'custom', '2026-06')).toEqual(['2026-06-16'])
  })
  it('每天：从首期到月末逐日（首期之前不出）', () => {
    const days = occurrencesInMonth('2026-06-28', 'daily', '2026-06')
    expect(days).toEqual(['2026-06-28', '2026-06-29', '2026-06-30'])
  })
  it('每周 / 每两周：按 7 / 14 天步进，远古首期也能落到本月', () => {
    expect(occurrencesInMonth('2026-05-01', 'weekly', '2026-06')).toEqual([
      '2026-06-05', '2026-06-12', '2026-06-19', '2026-06-26',
    ])
    expect(occurrencesInMonth('2026-01-05', 'biweekly', '2026-06')).toEqual(['2026-06-08', '2026-06-22'])
  })
  it('每月 / 每3月 / 每6月 / 每年：同日推进（远古首期快进到本月）', () => {
    expect(occurrencesInMonth('2025-06-16', 'monthly', '2026-06')).toEqual(['2026-06-16'])
    expect(occurrencesInMonth('2026-03-10', 'every3months', '2026-06')).toEqual(['2026-06-10'])
    expect(occurrencesInMonth('2025-12-20', 'every6months', '2026-06')).toEqual(['2026-06-20'])
    expect(occurrencesInMonth('2024-06-16', 'yearly', '2026-06')).toEqual(['2026-06-16'])
  })
  it('工作日 / 周末：按星期筛（2026-06：周末=6/13,14,20,21,27,28）', () => {
    const weekends = occurrencesInMonth('2026-06-10', 'weekends', '2026-06')
    expect(weekends).toEqual(['2026-06-13', '2026-06-14', '2026-06-20', '2026-06-21', '2026-06-27', '2026-06-28'])
    const weekdays = occurrencesInMonth('2026-06-25', 'weekdays', '2026-06')
    expect(weekdays).toEqual(['2026-06-25', '2026-06-26', '2026-06-29', '2026-06-30']) // 跳过 6/27 6/28 周末
  })
  it('首期晚于该月 → 空', () => {
    expect(occurrencesInMonth('2026-08-01', 'monthly', '2026-06')).toEqual([])
  })
})
