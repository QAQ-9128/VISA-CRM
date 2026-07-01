import { describe, it, expect } from 'vitest'
import { selectOccupationalDurations, stageDuration } from './occupationalDuration'
import type { CaseStageHistory } from '../types/models'

// 用「无 Z」的本地午夜时间戳 → localYmd 取本地日历日恒等于日期部分，跨 CI 时区确定性。
const hist = (to: CaseStageHistory['to_stage'], date: string): CaseStageHistory =>
  ({ to_stage: to, effective_at: `${date}T00:00:00`, from_stage: null } as CaseStageHistory)

describe('stageDuration（单段时长口径）', () => {
  it('该阶段未发生 → null', () => {
    expect(stageDuration([], 'oa_chn_verification', '2026-06-30')).toBeNull()
    expect(stageDuration([hist('oa_skill_submitted', '2026-06-01')], 'oa_chn_verification', '2026-06-30')).toBeNull()
  })

  it('发生后其后有更晚记录 → 冻结为(发生日→下一条记录日)的实际用时', () => {
    const h = [hist('oa_chn_verification', '2026-05-01'), hist('oa_skill_submitted', '2026-06-01')]
    const d = stageDuration(h, 'oa_chn_verification', '2026-06-30')
    expect(d).toEqual({ start: '2026-05-01', days: 31, ongoing: false })
  })

  it('仍停留在该阶段(其后无记录) → 累加到今天(本地)', () => {
    const h = [hist('oa_chn_verification', '2026-05-01'), hist('oa_skill_submitted', '2026-06-01')]
    const d = stageDuration(h, 'oa_skill_submitted', '2026-06-30')
    expect(d).toEqual({ start: '2026-06-01', days: 29, ongoing: true })
  })

  it('「下一条记录」取时间序上紧随其后的那一条(任意阶段)，与传入顺序无关', () => {
    const unsorted = [
      hist('oa_skill_submitted', '2026-06-01'),
      hist('oa_chn_verification', '2026-05-01'),
      hist('oa_rfe', '2026-06-20'),
    ]
    expect(stageDuration(unsorted, 'oa_skill_submitted', '2026-06-30')).toEqual({
      start: '2026-06-01',
      days: 19, // 06-01 → 06-20 冻结
      ongoing: false,
    })
  })

  it('同日发生→下一条同日 = 0 天(不为负)', () => {
    const h = [hist('oa_chn_verification', '2026-05-01'), hist('oa_skill_submitted', '2026-05-01')]
    expect(stageDuration(h, 'oa_chn_verification', '2026-06-30')?.days).toBe(0)
  })
})

describe('selectOccupationalDurations（两段）', () => {
  it('两段各自独立派生', () => {
    const h = [hist('oa_chn_verification', '2026-05-01'), hist('oa_skill_submitted', '2026-06-01')]
    const r = selectOccupationalDurations(h, '2026-06-30')
    expect(r.chn).toEqual({ start: '2026-05-01', days: 31, ongoing: false })
    expect(r.skill).toEqual({ start: '2026-06-01', days: 29, ongoing: true })
  })

  it('只发生技评、未发生 CHN → chn=null、skill 累加', () => {
    const r = selectOccupationalDurations([hist('oa_skill_submitted', '2026-06-01')], '2026-06-30')
    expect(r.chn).toBeNull()
    expect(r.skill).toEqual({ start: '2026-06-01', days: 29, ongoing: true })
  })
})
