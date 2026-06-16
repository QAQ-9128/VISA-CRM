import { describe, expect, it } from 'vitest'
import { monthMatrix, weekDays, shiftDays } from './calendarGrid'

describe('shiftDays / weekDays（本地，周一首日）', () => {
  it('shiftDays 跨月跨年', () => {
    expect(shiftDays('2026-06-30', 1)).toBe('2026-07-01')
    expect(shiftDays('2026-01-01', -1)).toBe('2025-12-31')
  })
  it('weekDays：含 2026-06-16(周二) 的那周 = 6/15(周一)…6/21(周日)', () => {
    const wk = weekDays('2026-06-16')
    expect(wk.map((d) => d.date)).toEqual([
      '2026-06-15', '2026-06-16', '2026-06-17', '2026-06-18', '2026-06-19', '2026-06-20', '2026-06-21',
    ])
  })
  it('weekDays：周一当天 → 该周从它自己起', () => {
    expect(weekDays('2026-06-15')[0].date).toBe('2026-06-15')
  })
})

describe('monthMatrix（月视图网格，周一首列，本地日期）', () => {
  it('2026-06：周一(6/1)首格在第一列、5 周、含上/下月补格标记', () => {
    const m = monthMatrix('2026-06') // 2026-06-01 是周一
    expect(m.length).toBe(5) // 30 天 + 0 前导 → 5 周
    expect(m[0][0]).toMatchObject({ date: '2026-06-01', day: 1, inMonth: true })
    expect(m[0][6]).toMatchObject({ date: '2026-06-07', day: 7, inMonth: true })
    // 末周：6/29 6/30 + 7/1..7/5（补格 inMonth=false）
    expect(m[4][0]).toMatchObject({ date: '2026-06-29', inMonth: true })
    expect(m[4][1]).toMatchObject({ date: '2026-06-30', inMonth: true })
    expect(m[4][2]).toMatchObject({ date: '2026-07-01', inMonth: false })
  })

  it('周中开月（2026-07-01 是周三）：前导补 6/29 6/30，1 号落第三列', () => {
    const m = monthMatrix('2026-07')
    expect(m[0][0]).toMatchObject({ date: '2026-06-29', inMonth: false }) // 周一
    expect(m[0][1]).toMatchObject({ date: '2026-06-30', inMonth: false }) // 周二
    expect(m[0][2]).toMatchObject({ date: '2026-07-01', day: 1, inMonth: true }) // 周三
  })

  it('每周 7 格、行数 = ceil((前导+天数)/7)', () => {
    for (const ym of ['2026-01', '2026-02', '2026-08', '2027-02']) {
      const m = monthMatrix(ym)
      for (const wk of m) expect(wk.length).toBe(7)
    }
    // 2026-02（28 天，2/1 周日 → 前导 6）→ ceil(34/7)=5 周
    expect(monthMatrix('2026-02').length).toBe(5)
  })
})
