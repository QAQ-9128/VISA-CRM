import { describe, expect, it } from 'vitest'
import { findVisaType, formatVisaType, hasStreamOptions } from './visa'

describe('formatVisaType', () => {
  it('有子类别 → "类别/子类别"', () => {
    expect(formatVisaType('482', 'Core Skills')).toBe('482/Core Skills')
    expect(formatVisaType('186', 'Direct Entry')).toBe('186/Direct Entry')
  })
  it('无子类别(null/空) → 仅类别', () => {
    expect(formatVisaType('820/801', null)).toBe('820/801')
    expect(formatVisaType('190', '')).toBe('190')
    expect(formatVisaType('500', '   ')).toBe('500')
    expect(formatVisaType('500')).toBe('500')
  })
})

describe('findVisaType', () => {
  it('命中目录里的类别', () => {
    expect(findVisaType('482')?.name).toBe('Skills in Demand')
    expect(findVisaType('820/801')?.name).toBe('Partner (Onshore)')
  })
  it('目录外(手填)类别 → undefined', () => {
    expect(findVisaType('887')).toBeUndefined()
    expect(findVisaType('')).toBeUndefined()
  })
  it('482 子类别含 Subsequent Entrant（对齐 494 已有的 stream）', () => {
    const streams = findVisaType('482')?.streams.map((s) => s.value) ?? []
    expect(streams).toContain('Core Skills')
    expect(streams).toContain('Subsequent Entrant')
  })
})

describe('hasStreamOptions', () => {
  it('有子类别或允许手填子类别 → true', () => {
    expect(hasStreamOptions('482')).toBe(true) // 有 streams
    expect(hasStreamOptions('189')).toBe(true)
  })
  it('无子类别 → false', () => {
    expect(hasStreamOptions('190')).toBe(false)
    expect(hasStreamOptions('820/801')).toBe(false)
    expect(hasStreamOptions('887')).toBe(false) // 目录外
  })
})
