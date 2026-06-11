import { describe, expect, it } from 'vitest'
import { matchesOwnerFilter, ownerFacetOptions } from './ownerFilter'
import { EMPTY_FILTER } from './casesList'
import { EMPTY_CUSTOMER_FILTER } from './customersFilter'

describe('ownerFilter · 「客户归属人」筛选（案件/客户两个筛选栏共用同一套逻辑）', () => {
  it('选项 = 现有归属值 distinct，按名排序；无归属的行不产出选项', () => {
    const opts = ownerFacetOptions([
      { ownerId: 'o1', ownerName: '王老板' },
      { ownerId: 'o2', ownerName: '李老板' },
      { ownerId: 'o1', ownerName: '王老板' }, // 重复 → 去重
      { ownerId: null, ownerName: '' }, // 无归属 → 跳过
    ])
    expect(opts).toEqual([
      { id: 'o2', name: '李老板' },
      { id: 'o1', name: '王老板' },
    ])
    expect(ownerFacetOptions([])).toEqual([])
  })

  it('匹配规则：空集不限；选中后须有归属且命中（无归属被排除）', () => {
    expect(matchesOwnerFilter(new Set(), null)).toBe(true)
    expect(matchesOwnerFilter(new Set(), 'o1')).toBe(true)
    expect(matchesOwnerFilter(new Set(['o1']), 'o1')).toBe(true)
    expect(matchesOwnerFilter(new Set(['o1']), 'o2')).toBe(false)
    expect(matchesOwnerFilter(new Set(['o1']), null)).toBe(false)
  })

  it('两处筛选器形状一致：都有 ownerIds、都没有担保雇主/介绍人维度', () => {
    expect('ownerIds' in EMPTY_FILTER).toBe(true)
    expect('ownerIds' in EMPTY_CUSTOMER_FILTER).toBe(true)
    for (const f of [EMPTY_FILTER, EMPTY_CUSTOMER_FILTER] as object[]) {
      expect('employerIds' in f).toBe(false)
      expect('referrerIds' in f).toBe(false)
    }
  })
})
