import { describe, expect, it } from 'vitest'
import { groupCustomersByFamily } from './customerGroups'
import type { Customer } from '../types/models'

const mk = (o: Partial<Customer>): Customer => ({
  id: 'cu', full_name: '客户', is_starred: false, client_source: null, primary_applicant_id: null,
  relationship_to_primary: null, birth_date: null, gender: null, passport_no: null, nationality: null, phone: null,
  email: null, wechat: null, address: null, sponsor_employer_id: null, sponsor_position: null, referrer_id: null, notes: null,
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
    expect(groups[0].subs.map((s) => s.customer.id)).toEqual(['s2', 's1']) // 按添加时间升序：丙(1/15)→乙(2/1)
    expect(groups[1].subs).toEqual([])
    expect(groups.every((g) => !g.orphan)).toBe(true)
  })

  it('一键添加的家庭成员（仅 primary_applicant_id+姓名，其余 null）照常缩进归属到主申请下', () => {
    const customers = [
      mk({ id: 'p1', full_name: '主申' }),
      // 模拟快速添加产出：只挂靠 + 姓名，gender/birth_date/relationship 都空
      mk({ id: 'quick', full_name: '快速成员', primary_applicant_id: 'p1', gender: null, birth_date: null, relationship_to_primary: null }),
    ]
    const groups = groupCustomersByFamily(customers)
    expect(groups.map((g) => g.primary?.id)).toEqual(['p1']) // 成员不在顶层
    expect(groups[0].subs.map((s) => s.customer.id)).toEqual(['quick']) // 缩进挂在主申下
  })

  it('锚定排序：星标 → 姓名（不再依赖等级/来源）', () => {
    const customers = [
      mk({ id: 'b', full_name: 'B', client_source: 'red' }),
      mk({ id: 'star', full_name: 'Z', is_starred: true, client_source: 'yellow' }),
      mk({ id: 'm', full_name: 'M', client_source: 'green' }),
      mk({ id: 'a', full_name: 'A' }),
    ]
    const groups = groupCustomersByFamily(customers)
    // 星标 Z 置顶；其余按姓名 A→B→M（来源不影响排序）
    expect(groups.map((g) => g.primary?.id)).toEqual(['star', 'a', 'b', 'm'])
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
    expect(last.subs.map((s) => s.customer.id)).toEqual(['orphan'])
    // 非孤儿组都在前面
    expect(groups.slice(0, -1).every((g) => !g.orphan)).toBe(true)
  })

  it('无孤儿时不产生孤儿组', () => {
    const groups = groupCustomersByFamily([mk({ id: 'p1' })])
    expect(groups).toHaveLength(1)
    expect(groups[0].orphan).toBe(false)
  })

  it('原生副申标记 linked=false、关系取自身 relationship_to_primary', () => {
    const customers = [mk({ id: 'p1' }), mk({ id: 's1', primary_applicant_id: 'p1', relationship_to_primary: '子女' })]
    const sub = groupCustomersByFamily(customers)[0].subs[0]
    expect(sub).toMatchObject({ linked: false, relationship: '子女' })
    expect(sub.customer.id).toBe('s1')
  })
})

const mkLink = (o: { primary_customer_id: string; member_customer_id: string; relationship?: string | null }) => ({
  id: `${o.primary_customer_id}-${o.member_customer_id}`,
  primary_customer_id: o.primary_customer_id,
  member_customer_id: o.member_customer_id,
  relationship: o.relationship ?? null,
  created_at: '',
  updated_at: '',
})

describe('groupCustomersByFamily — 关联现有客户（family_member_links）', () => {
  it('关联成员既在顶层(自己组)、又作为 sub 挂在主申下，且 linked=true（两处显示）', () => {
    const customers = [
      mk({ id: 'A', full_name: '主申A', is_starred: true }),
      mk({ id: 'B', full_name: '独立客户B' }), // B 是独立主申，有自己的顶层组
    ]
    const links = [mkLink({ primary_customer_id: 'A', member_customer_id: 'B', relationship: '配偶' })]
    const groups = groupCustomersByFamily(customers, links)
    // B 仍是顶层锚定
    expect(groups.map((g) => g.primary?.id)).toEqual(['A', 'B'])
    // B 同时作为关联 sub 挂在 A 下
    const aSub = groups.find((g) => g.primary?.id === 'A')!.subs[0]
    expect(aSub).toMatchObject({ linked: true, relationship: '配偶' })
    expect(aSub.customer.id).toBe('B')
  })

  it('关联到不存在/已归档(不在列表)的成员 → 不显示', () => {
    const customers = [mk({ id: 'A' })]
    const links = [mkLink({ primary_customer_id: 'A', member_customer_id: 'gone' })]
    expect(groupCustomersByFamily(customers, links)[0].subs).toEqual([])
  })

  it('已是原生副申的客户不因关联重复出现（去重）', () => {
    const customers = [mk({ id: 'A' }), mk({ id: 'S', primary_applicant_id: 'A' })]
    const links = [mkLink({ primary_customer_id: 'A', member_customer_id: 'S' })]
    const subs = groupCustomersByFamily(customers, links)[0].subs
    expect(subs.map((s) => s.customer.id)).toEqual(['S'])
    expect(subs[0].linked).toBe(false) // 原生优先
  })

  it('不传 links → 与现状完全一致（回归）', () => {
    const customers = [mk({ id: 'A' }), mk({ id: 'S', primary_applicant_id: 'A' })]
    expect(groupCustomersByFamily(customers)).toEqual(groupCustomersByFamily(customers, []))
  })
})
