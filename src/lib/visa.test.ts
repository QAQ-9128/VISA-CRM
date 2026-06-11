import { describe, expect, it } from 'vitest'
import { formatVisaType } from './visa'

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
