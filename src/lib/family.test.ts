import { describe, expect, it } from 'vitest'
import { selectFamilyGroupMembers, selectCoApplicantCases, selectJoinableCases } from './family'
import type { Case, CaseApplicant, Customer } from '../types/models'

const mkCustomer = (o: Partial<Customer>): Customer => ({
  id: 'cu1', full_name: '主申', is_starred: false, client_source: null, primary_applicant_id: null,
  relationship_to_primary: null, birth_date: null, gender: null, passport_no: null, nationality: null, phone: null,
  email: null, wechat: null, address: null, sponsor_employer_id: null, sponsor_position: null, referrer_id: null, notes: null,
  assigned_to: null, created_by: null, is_archived: false, created_at: '', updated_at: '', ...o,
})
const mkCase = (o: Partial<Case>): Case => ({
  id: 'c1', case_number: '00000001', customer_id: 'head', visa_subclass: '482', visa_stream: null, current_stage: 'todo',
  currency: 'AUD', sync_tracking: true, trt_reminder_enabled: false, destination_country: 'Australia', assigned_to: null, created_by: null,
  is_archived: false, created_at: '', updated_at: '', ...o,
})
const ca = (case_id: string, customer_id: string): CaseApplicant => ({
  id: `${case_id}-${customer_id}`, case_id, customer_id, created_at: '',
})

// 家庭组：head(主申) + sub1 / sub2(副申)；other 是无关客户
const head = mkCustomer({ id: 'head', full_name: '李旻书' })
const sub1 = mkCustomer({ id: 'sub1', full_name: '邓韬', primary_applicant_id: 'head' })
const sub2 = mkCustomer({ id: 'sub2', full_name: '小孩', primary_applicant_id: 'head' })
const other = mkCustomer({ id: 'other', full_name: '陌生人' })
const archivedSub = mkCustomer({ id: 'arc', full_name: '已归档', primary_applicant_id: 'head', is_archived: true })
const ALL = [head, sub1, sub2, other, archivedSub]

describe('selectFamilyGroupMembers', () => {
  it('从主申看：同组其他成员(排除自身/归档)', () => {
    expect(selectFamilyGroupMembers('head', ALL).map((c) => c.id)).toEqual(['sub1', 'sub2'])
  })
  it('双向：从副申看也能拿到主申 + 其他副申', () => {
    expect(selectFamilyGroupMembers('sub1', ALL).map((c) => c.id).sort()).toEqual(['head', 'sub2'])
  })
  it('无关客户不在组内', () => {
    expect(selectFamilyGroupMembers('other', ALL).map((c) => c.id)).toEqual([])
  })
})

describe('selectCoApplicantCases', () => {
  it('取该客户作为副申参与、且非本人主申、未归档的案件', () => {
    const cases = [
      mkCase({ id: 'cA', customer_id: 'head' }), // sub1 作为副申参与
      mkCase({ id: 'cB', customer_id: 'sub1' }), // sub1 是主申 → 不算「作为副申」
      mkCase({ id: 'cC', customer_id: 'head', is_archived: true }), // 归档排除
    ]
    const applicants = [ca('cA', 'sub1'), ca('cB', 'sub1'), ca('cC', 'sub1')]
    expect(selectCoApplicantCases(cases, applicants, 'sub1').map((c) => c.id)).toEqual(['cA'])
  })
})

describe('selectJoinableCases', () => {
  it('同组成员名下、未加入、非本人主申、未归档的案件可加入', () => {
    const cases = [
      mkCase({ id: 'cHead', customer_id: 'head' }), // 同组主申案件，可加入
      mkCase({ id: 'cJoined', customer_id: 'head' }), // 已加入 → 排除
      mkCase({ id: 'cMine', customer_id: 'sub1' }), // 本人主申 → 排除
      mkCase({ id: 'cOther', customer_id: 'other' }), // 非同组 → 排除
    ]
    const applicants = [ca('cJoined', 'sub1')]
    expect(selectJoinableCases(cases, applicants, 'sub1', ALL).map((c) => c.id)).toEqual(['cHead'])
  })
})
