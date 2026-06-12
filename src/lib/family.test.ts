import { describe, expect, it } from 'vitest'
import { selectFamilyGroupMembers, selectCoApplicantCases, selectCustomerCases, selectJoinableCases } from './family'
import type { Case, CaseApplicant, Customer, FamilyMemberLink } from '../types/models'

const link = (primary: string, member: string): FamilyMemberLink =>
  ({ id: `${primary}-${member}`, primary_customer_id: primary, member_customer_id: member, relationship: null, created_at: '', updated_at: '' }) as FamilyMemberLink

const mkCustomer = (o: Partial<Customer>): Customer => ({
  id: 'cu1', full_name: '主申', is_starred: false, client_source: null, primary_applicant_id: null,
  relationship_to_primary: null, birth_date: null, gender: null, passport_no: null, nationality: null, phone: null,
  chinese_name: null, english_name: null,
  email: null, wechat: null, address: null, sponsor_employer_id: null, sponsor_position: null, referrer_id: null, owner_referrer_id: null, notes: null,
  assigned_to: null, created_by: null, is_archived: false, created_at: '', updated_at: '', ...o,
})
const mkCase = (o: Partial<Case>): Case => ({
  id: 'c1', case_number: '00000001', customer_id: 'head', visa_subclass: '482', visa_stream: null, case_category: null, case_details: null, current_stage: 'todo',
  currency: 'AUD', sync_tracking: true, trt_reminder_enabled: false, trt_reminder_dismissed: false, cohab_reminder_enabled: false, cohab_reminder_last: null, parent_case_id: null, parent_sync_progress: false, destination_country: 'Australia', sponsor_position: null, sponsor_employer_id: null, immi_account_id: null, assigned_to: null, created_by: null,
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
  it('不传 links → 旧行为不变（向后兼容）', () => {
    expect(selectFamilyGroupMembers('head', ALL).map((c) => c.id)).toEqual(['sub1', 'sub2'])
  })
  it('关联现有客户：传 links 后，关联成员(other)进候选；双向', () => {
    const links = [link('head', 'other')] // other 被关联为 head 的副申（不改 primary_applicant_id）
    expect(selectFamilyGroupMembers('head', ALL, links).map((c) => c.id).sort()).toEqual(['other', 'sub1', 'sub2'])
    // 反向：从 other 看，head 也是其「案件家庭组」成员
    expect(selectFamilyGroupMembers('other', ALL, links).map((c) => c.id)).toEqual(['head'])
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

  it('关联现有客户（有独立案件）：双向可加入', () => {
    // other 有自己的案件 cOther；other 关联为 head 的副申
    const cases = [
      mkCase({ id: 'c482', customer_id: 'head' }), // head 的 482
      mkCase({ id: 'cOther', customer_id: 'other' }), // other 自己的案件
    ]
    const links = [link('head', 'other')]
    // head 可加入 other 的案件（cOther 进可加入）；不传 links 则看不到
    expect(selectJoinableCases(cases, [], 'head', ALL).map((c) => c.id)).toEqual([])
    expect(selectJoinableCases(cases, [], 'head', ALL, links).map((c) => c.id)).toEqual(['cOther'])
    // 反向：other 可加入 head 的 482
    expect(selectJoinableCases(cases, [], 'other', ALL, links).map((c) => c.id)).toEqual(['c482'])
  })
})

describe('selectCustomerCases（客户详情案件来源 = 拥有 ∪ 参与）', () => {
  const ownA = mkCase({ id: 'ownA', customer_id: 'sub1', created_at: '2026-02-01' })
  const ownB = mkCase({ id: 'ownB', customer_id: 'sub1', created_at: '2026-01-01' })
  const aliceCase = mkCase({ id: 'al', customer_id: 'head', created_at: '2026-03-01' })
  const archivedOwn = mkCase({ id: 'arcC', customer_id: 'sub1', is_archived: true })
  const unrelated = mkCase({ id: 'un', customer_id: 'other' })
  const applicants = [ca('al', 'sub1')] // sub1 参与 head 名下的案件
  const cases = [ownA, ownB, aliceCase, archivedOwn, unrelated]

  it('拥有在前（按 created_at）+ 参与的在后', () => {
    expect(selectCustomerCases('sub1', cases, applicants).map((c) => c.id)).toEqual(['ownB', 'ownA', 'al'])
  })
  it('排除归档与无关案件', () => {
    const ids = selectCustomerCases('sub1', cases, applicants).map((c) => c.id)
    expect(ids).not.toContain('arcC')
    expect(ids).not.toContain('un')
  })
  it('纯参与人（无自有案件）也能看到参与的案件', () => {
    expect(selectCustomerCases('sub2', [aliceCase], [ca('al', 'sub2')]).map((c) => c.id)).toEqual(['al'])
  })
})
