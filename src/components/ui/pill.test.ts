import { describe, expect, it } from 'vitest'
import { PILL_TONE, PILL_TONES } from './pill'

describe('PILL_TONE（状态标签语义色 → 现有 Tailwind 类名，供统一 Pill 用）', () => {
  it('每个 tone 输出预期的 bg/text 类名', () => {
    expect(PILL_TONE.neutral).toBe('bg-slate-100 text-slate-700')
    expect(PILL_TONE.muted).toBe('bg-slate-100 text-slate-500')
    expect(PILL_TONE.success).toBe('bg-emerald-100 text-emerald-700')
    expect(PILL_TONE.warning).toBe('bg-amber-100 text-amber-800')
    expect(PILL_TONE.danger).toBe('bg-rose-100 text-rose-700')
    expect(PILL_TONE.info).toBe('bg-blue-100 text-blue-700')
    expect(PILL_TONE.accent).toBe('bg-indigo-100 text-indigo-800')
  })

  it('PILL_TONES 覆盖全部 7 个 tone 且 map 完整', () => {
    expect(PILL_TONES).toEqual(['neutral', 'muted', 'success', 'warning', 'danger', 'info', 'accent'])
    for (const t of PILL_TONES) {
      expect(typeof PILL_TONE[t]).toBe('string')
      expect(PILL_TONE[t]).toMatch(/^bg-\w+-\d+ text-\w+-\d+$/)
    }
  })
})
