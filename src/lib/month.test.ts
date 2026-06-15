import { describe, expect, it } from 'vitest'
import { currentMonth, shiftMonth, monthLabel, monthPickerBounds, isMonthInBounds } from './month'

describe('currentMonth', () => {
  it('返回本地年月 YYYY-MM（补零）', () => {
    expect(currentMonth(new Date(2026, 0, 9))).toBe('2026-01')
    expect(currentMonth(new Date(2026, 11, 31))).toBe('2026-12')
  })

  it('跨 UTC 日界用本地年月：本地 6/30 23:00（UTC 已是 7/1）仍归 2026-06', () => {
    // new Date(year, monthIdx, day, hour) 按本地时区构造；本地 6 月底深夜在 UTC 已跨月
    expect(currentMonth(new Date(2026, 5, 30, 23, 0))).toBe('2026-06')
    // 本地元旦凌晨（UTC 仍是去年 12/31）仍归本地 1 月
    expect(currentMonth(new Date(2026, 0, 1, 0, 30))).toBe('2026-01')
  })
})

describe('monthPickerBounds（下限 = min(最早记录年, 当前年−5) 的 1 月；上限 = 今天所在月）', () => {
  it('无记录：下限 = 当前年 − 5 的 1 月，上限 = 今天所在月', () => {
    expect(monthPickerBounds(null, '2026-06')).toEqual({ min: '2021-01', max: '2026-06' })
    expect(monthPickerBounds(undefined, '2026-06')).toEqual({ min: '2021-01', max: '2026-06' })
  })

  it('记录晚于「5 年前」：仍保证能往回翻 5 年（下限不被抬高）', () => {
    // 最早记录 2025-11，但下限仍放到 2021-01（当前年 − 5）
    expect(monthPickerBounds('2025-11', '2026-06')).toEqual({ min: '2021-01', max: '2026-06' })
  })

  it('记录早于「5 年前」：下限再往前放到最早记录年的 1 月', () => {
    expect(monthPickerBounds('2018-09', '2026-06')).toEqual({ min: '2018-01', max: '2026-06' })
  })
})

describe('isMonthInBounds（箭头与月网格共用的唯一判定）', () => {
  const b = monthPickerBounds('2025-11', '2026-06') // { min: '2021-01', max: '2026-06' }
  it('过去月（含整年）一律可选；未来月（晚于今天）不可选', () => {
    expect(isMonthInBounds('2021-01', b)).toBe(true) // 下限
    expect(isMonthInBounds('2020-12', b)).toBe(false) // 越过下限
    expect(isMonthInBounds('2025-01', b)).toBe(true) // 无记录的过去月仍可选
    expect(isMonthInBounds('2026-06', b)).toBe(true) // 上限（今天所在月）
    expect(isMonthInBounds('2026-07', b)).toBe(false) // 未来月
  })

  it('参数化：「箭头可达」⟺「Popover 可点」（同一来源，结果一致）', () => {
    const cases: Array<[string, boolean]> = [
      ['2020-12', false],
      ['2021-01', true],
      ['2023-06', true],
      ['2026-06', true],
      ['2026-07', false],
    ]
    for (const [ym, expected] of cases) {
      // 箭头是否允许落到该月、月网格该格是否可点，都只问 isMonthInBounds → 必然一致
      expect(isMonthInBounds(ym, b)).toBe(expected)
    }
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
