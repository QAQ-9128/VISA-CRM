import { describe, expect, it } from 'vitest'
import { replaceDateKeepTime } from './stageHistory'

describe('replaceDateKeepTime', () => {
  it('换日期、保留原时分秒(及时区后缀)', () => {
    expect(replaceDateKeepTime('2026-05-29T20:20:55.000Z', '2026-05-20')).toBe('2026-05-20T20:20:55.000Z')
    expect(replaceDateKeepTime('2026-01-01T08:30:00+10:00', '2025-12-31')).toBe('2025-12-31T08:30:00+10:00')
  })
  it('原值无时间部分 → 用 00:00:00', () => {
    expect(replaceDateKeepTime('2026-05-29', '2026-05-20')).toBe('2026-05-20T00:00:00')
  })
})
