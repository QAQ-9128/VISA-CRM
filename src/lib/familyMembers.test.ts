import { describe, expect, it } from 'vitest'
import { FAMILY_RELATIONS, selectFamilyByCustomer } from './familyMembers'
import type { CustomerFamilyMember } from '../types/models'

const mk = (o: Partial<CustomerFamilyMember>): CustomerFamilyMember => ({
  id: 'f1', customer_id: 'P', name: '王璜', relation: '配偶', linked_customer_id: null, created_at: '2026-01-01', ...o,
})

describe('familyMembers', () => {
  it('FAMILY_RELATIONS 预设 = 配偶/子女/父母/兄弟姐妹/其他（可手填任意值）', () => {
    expect(FAMILY_RELATIONS).toEqual(['配偶', '子女', '父母', '兄弟姐妹', '其他'])
  })

  it('selectFamilyByCustomer：只取该客户的成员，按 created_at 升序', () => {
    const all = [
      mk({ id: 'a', customer_id: 'P', name: '小明', created_at: '2026-02-01' }),
      mk({ id: 'b', customer_id: 'Q', name: '别家的', created_at: '2026-01-01' }),
      mk({ id: 'c', customer_id: 'P', name: '王璜', created_at: '2026-01-05' }),
    ]
    const out = selectFamilyByCustomer(all, 'P')
    expect(out.map((m) => m.name)).toEqual(['王璜', '小明']) // P 的两位，按录入序；Q 的不含
  })

  it('空客户 id → 空数组', () => {
    expect(selectFamilyByCustomer([mk({})], null)).toEqual([])
    expect(selectFamilyByCustomer([mk({})], undefined)).toEqual([])
  })
})
