import { describe, expect, it } from 'vitest'
import { groupCode } from './groupCode'

describe('groupCode', () => {
  it('确定性：同一 id 永远同码', () => {
    expect(groupCode('abc-123')).toBe(groupCode('abc-123'))
  })
  it('格式：G- 前缀 + 4 位', () => {
    expect(groupCode('any-root-id')).toMatch(/^G-[0-9A-Z]{4}$/)
  })
  it('不同根通常不同码', () => {
    expect(groupCode('root-a')).not.toBe(groupCode('root-b'))
  })
  it('空 id → G-0000', () => {
    expect(groupCode('')).toBe('G-0000')
  })
})

