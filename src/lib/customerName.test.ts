import { describe, expect, it } from 'vitest'
import { customerDisplayName } from './customerName'

describe('customerDisplayName（显示名单一来源：中文 ?? 英文 ?? 旧 full_name）', () => {
  it('有中文名 → 显中文（无论英文名是否存在）', () => {
    expect(customerDisplayName({ chinese_name: '邓韬', english_name: 'DENG Tao', full_name: '邓韬' })).toBe('邓韬')
    expect(customerDisplayName({ chinese_name: '李旻书', english_name: null, full_name: '' })).toBe('李旻书')
  })

  it('只有英文名 → 显英文，按录入原样（不改大小写）', () => {
    expect(customerDisplayName({ chinese_name: null, english_name: 'DENG Tao', full_name: '旧名' })).toBe('DENG Tao')
    expect(customerDisplayName({ chinese_name: '', english_name: 'LI Minshu', full_name: '' })).toBe('LI Minshu')
    // 原样显示：系统不自动转大小写
    expect(customerDisplayName({ chinese_name: null, english_name: 'deng tao', full_name: null })).toBe('deng tao')
  })

  it('两者都没有 → 兜底旧 full_name（老数据不破坏）', () => {
    expect(customerDisplayName({ chinese_name: null, english_name: null, full_name: '张三' })).toBe('张三')
    expect(customerDisplayName({ full_name: '张三' })).toBe('张三')
  })

  it('空串/空白视为未填（不会显示成空白名）；全空返回 ""', () => {
    expect(customerDisplayName({ chinese_name: '  ', english_name: ' DENG Tao ', full_name: 'x' })).toBe('DENG Tao')
    expect(customerDisplayName({ chinese_name: null, english_name: null, full_name: null })).toBe('')
    expect(customerDisplayName(null)).toBe('')
    expect(customerDisplayName(undefined)).toBe('')
  })
})
