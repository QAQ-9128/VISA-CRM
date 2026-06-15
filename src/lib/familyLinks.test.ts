import { describe, expect, it } from 'vitest'
import { selectLinkedMembers, selectLinkedInto, selectLinkCandidates } from './familyLinks'
import type { Customer, FamilyMemberLink } from '../types/models'

const mk = (o: Partial<Customer>): Customer => ({
  id: 'cu', full_name: '客户', is_starred: false, client_source: null, primary_applicant_id: null,
  relationship_to_primary: null, birth_date: null, gender: null, passport_no: null, nationality: null, phone: null,
  chinese_name: null, english_name: null,
  email: null, wechat: null, address: null, sponsor_employer_id: null, sponsor_position: null, referrer_id: null, owner_referrer_id: null, notes: null,
  assigned_to: null, created_by: null, is_archived: false, created_at: '', updated_at: '', ...o,
})
const mkLink = (o: Partial<FamilyMemberLink> & { primary_customer_id: string; member_customer_id: string }): FamilyMemberLink => ({
  id: `${o.primary_customer_id}-${o.member_customer_id}`, relationship: null, created_at: '', updated_at: '', ...o,
})

const A = mk({ id: 'A', full_name: '主申A' })
const B = mk({ id: 'B', full_name: '客户B' })
const C = mk({ id: 'C', full_name: '客户C' })
const customers = [A, B, C, mk({ id: 'S', full_name: '原生副申', primary_applicant_id: 'A' })]
const byId = Object.fromEntries(customers.map((c) => [c.id, c]))
const links = [
  mkLink({ primary_customer_id: 'A', member_customer_id: 'B', relationship: '配偶' }),
  mkLink({ primary_customer_id: 'C', member_customer_id: 'B', relationship: '子女' }),
]

describe('selectLinkedMembers（A 名下关联进来的成员）', () => {
  it('列出 A 的关联成员 + 关系 + linkId', () => {
    const r = selectLinkedMembers('A', links, byId)
    expect(r).toEqual([{ linkId: 'A-B', customer: B, relationship: '配偶' }])
  })
  it('成员不在 byId → 跳过', () => {
    const r = selectLinkedMembers('A', [mkLink({ primary_customer_id: 'A', member_customer_id: 'gone' })], byId)
    expect(r).toEqual([])
  })
})

describe('selectLinkedInto（B 被关联进了哪些家庭组——反向）', () => {
  it('列出把 B 关联进去的主申 + 关系 + linkId', () => {
    const r = selectLinkedInto('B', links, byId)
    expect(r.map((x) => [x.primary.id, x.relationship])).toEqual([['A', '配偶'], ['C', '子女']])
  })
})

describe('selectLinkCandidates（可关联候选：排除本人/A 的原生副申/已关联/归档）', () => {
  it('排除 A 本人、A 的原生副申 S、已关联的 B；留下 C', () => {
    const r = selectLinkCandidates('A', customers, links)
    expect(r.map((c) => c.id)).toEqual(['C'])
  })
  it('排除归档客户', () => {
    const arch = mk({ id: 'arch', full_name: '已归档', is_archived: true })
    const r = selectLinkCandidates('A', [A, C, arch], [])
    expect(r.map((c) => c.id)).toEqual(['C'])
  })
})
