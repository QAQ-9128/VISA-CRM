import { describe, expect, it } from 'vitest'
import { groupCustomersByFamily } from './customerGroups'
import type { Customer } from '../types/models'

const mk = (o: Partial<Customer>): Customer => ({
  id: 'cu', full_name: '客户', is_starred: false, priority_tier: null, primary_applicant_id: null,
  relationship_to_primary: null, birth_date: null, gender: null, passport_no: null, nationality: null, phone: null,
  email: null, wechat: null, address: null, sponsor_employer_id: null, referrer_id: null, notes: null,
  assigned_to: null, created_by: null, is_archived: false, created_at: '2026-01-01T00:00:00Z', updated_at: '', ...o,
})

describe('groupCustomersByFamily', () => {
  it('主申带副申成组；副申不再顶层出现', () => {
    const customers = [
      mk({ id: 'p1', full_name: '甲', is_starred: true }), // 星标 → 锚定排第一（与排序无关，保证断言确定）
      mk({ id: 's1', full_name: '乙', primary_applicant_id: 'p1', created_at: '2026-02-01T00:00:00Z' }),
      mk({ id: 's2', full_name: '丙', primary_applicant_id: 'p1', created_at: '2026-01-15T00:00:00Z' }),
      mk({ id: 'p2', full_name: '丁' }), // 独立客户，无副申
    ]
    const groups = groupCustomersByFamily(customers)
    expect(groups.map((g) => g.primary?.id)).toEqual(['p1', 'p2'])
    expect(groups[0].subs.map((s) => s.id)).toEqual(['s2', 's1']) // 按添加时间升序：丙(1/15)→乙(2/1)
    expect(groups[1].subs).toEqual([])
    expect(groups.every((g) => !g.orphan)).toBe(true)
  })

  it('锚定排序：星标 → 等级 → 姓名', () => {
    const customers = [
      mk({ id: 'b', full_name: 'B', priority_tier: 'b' }),
      mk({ id: 'star', full_name: 'Z', is_starred: true, priority_tier: 'c' }),
      mk({ id: 'vip', full_name: 'M', priority_tier: 'vip' }),
      mk({ id: 'a', full_name: 'A', priority_tier: 'a' }),
    ]
    const groups = groupCustomersByFamily(customers)
    expect(groups.map((g) => g.primary?.id)).toEqual(['star', 'vip', 'a', 'b'])
  })

  it('孤儿副申(主申不在列表)放末尾单独一组并标记 orphan', () => {
    const customers = [
      mk({ id: 'p1', full_name: '甲' }),
      mk({ id: 's1', full_name: '乙', primary_applicant_id: 'p1' }),
      mk({ id: 'orphan', full_name: '孤', primary_applicant_id: 'deleted' }),
    ]
    const groups = groupCustomersByFamily(customers)
    const last = groups[groups.length - 1]
    expect(last.orphan).toBe(true)
    expect(last.primary).toBeNull()
    expect(last.subs.map((s) => s.id)).toEqual(['orphan'])
    // 非孤儿组都在前面
    expect(groups.slice(0, -1).every((g) => !g.orphan)).toBe(true)
  })

  it('无孤儿时不产生孤儿组', () => {
    const groups = groupCustomersByFamily([mk({ id: 'p1' })])
    expect(groups).toHaveLength(1)
    expect(groups[0].orphan).toBe(false)
  })
})
