import { describe, expect, it } from 'vitest'
import { selectParentCaseCandidates, parentCaseDropdown } from './parentCase'
import type { Case, Customer } from '../types/models'

const mkCustomer = (o: Partial<Customer>): Customer => ({
  id: 'cu1', full_name: '主申', is_starred: false, client_source: null, primary_applicant_id: null,
  relationship_to_primary: null, birth_date: null, gender: null, passport_no: null, nationality: null, phone: null,
  email: null, wechat: null, address: null, sponsor_employer_id: null, sponsor_position: null, referrer_id: null, notes: null,
  assigned_to: null, created_by: null, is_archived: false, created_at: '', updated_at: '', ...o,
})
const mkCase = (o: Partial<Case>): Case => ({
  id: 'c1', case_number: '00000001', customer_id: 'head', visa_subclass: '482', visa_stream: null, current_stage: 'todo',
  currency: 'AUD', sync_tracking: true, trt_reminder_enabled: false, parent_case_id: null, parent_sync_progress: false, destination_country: 'Australia',
  assigned_to: null, created_by: null, is_archived: false, created_at: '', updated_at: '', ...o,
})

// 家庭组：head(主申) ← sub(副申，primary_applicant_id=head)；lone 是无家庭组的独立客户
const head = mkCustomer({ id: 'head', full_name: '李旻书' })
const sub = mkCustomer({ id: 'sub', full_name: '邓韬', primary_applicant_id: 'head' })
const lone = mkCustomer({ id: 'lone', full_name: '独立客户' })
const CUSTOMERS = [head, sub, lone]

describe('selectParentCaseCandidates（依附主案件下拉范围：副申看其家庭组主申名下案件）', () => {
  it('有家庭组、主申有 case → 列出主申名下未归档案件（按创建时间倒序）', () => {
    const cases = [
      mkCase({ id: 'p1', customer_id: 'head', created_at: '2026-01-01' }),
      mkCase({ id: 'p2', customer_id: 'head', created_at: '2026-03-01' }),
    ]
    expect(selectParentCaseCandidates(cases, 'sub', CUSTOMERS).map((c) => c.id)).toEqual(['p2', 'p1'])
  })

  it('有家庭组、主申无 case → 空（→ UI 显示「无可选」）', () => {
    const cases = [mkCase({ id: 'x', customer_id: 'sub' })] // 主申 head 名下没有案件
    expect(selectParentCaseCandidates(cases, 'sub', CUSTOMERS)).toEqual([])
  })

  it('无家庭组（自己就是主申/独立客户）→ 空', () => {
    const cases = [mkCase({ id: 'l1', customer_id: 'lone' })]
    expect(selectParentCaseCandidates(cases, 'lone', CUSTOMERS)).toEqual([])
  })

  it('排除归档的主申案件', () => {
    const cases = [
      mkCase({ id: 'p1', customer_id: 'head' }),
      mkCase({ id: 'arc', customer_id: 'head', is_archived: true }),
    ]
    expect(selectParentCaseCandidates(cases, 'sub', CUSTOMERS).map((c) => c.id)).toEqual(['p1'])
  })

  it('排除正在编辑的案件本身（不能依附自己）', () => {
    const cases = [
      mkCase({ id: 'p1', customer_id: 'head' }),
      mkCase({ id: 'self', customer_id: 'head' }),
    ]
    expect(selectParentCaseCandidates(cases, 'sub', CUSTOMERS, 'self').map((c) => c.id)).toEqual(['p1'])
  })
})

describe('parentCaseDropdown（严格只列家庭主申名下案件 + 空态判定，驱动 radio 2/3 启用）', () => {
  it('有家庭主申且其有 case → state=has-cases，列出（created_at 倒序）', () => {
    const cases = [
      mkCase({ id: 'p1', customer_id: 'head', created_at: '2026-01-01' }),
      mkCase({ id: 'p2', customer_id: 'head', created_at: '2026-03-01' }),
    ]
    const r = parentCaseDropdown(cases, 'sub', CUSTOMERS)
    expect(r.state).toBe('has-cases')
    expect(r.candidates.map((c) => c.id)).toEqual(['p2', 'p1'])
  })

  it('有家庭主申但其无 case → state=primary-no-cases，候选空（radio 2/3 禁用）', () => {
    const cases = [mkCase({ id: 'x', customer_id: 'sub' })] // 主申 head 名下无案件
    const r = parentCaseDropdown(cases, 'sub', CUSTOMERS)
    expect(r.state).toBe('primary-no-cases')
    expect(r.candidates).toEqual([])
  })

  it('无家庭主申（本人是主申/无家庭组）→ state=no-family-primary，候选空（radio 2/3 禁用）', () => {
    const cases = [mkCase({ id: 'l1', customer_id: 'lone' })]
    const r = parentCaseDropdown(cases, 'lone', CUSTOMERS)
    expect(r.state).toBe('no-family-primary')
    expect(r.candidates).toEqual([])
  })

  it('家庭主申名下有已归档 case → 归档不出现在下拉里', () => {
    const cases = [
      mkCase({ id: 'p1', customer_id: 'head' }),
      mkCase({ id: 'arc', customer_id: 'head', is_archived: true }),
    ]
    const r = parentCaseDropdown(cases, 'sub', CUSTOMERS)
    expect(r.state).toBe('has-cases')
    expect(r.candidates.map((c) => c.id)).toEqual(['p1'])
  })
})
