import { describe, expect, it } from 'vitest'
import { initialFormState, toPayload } from './customerForm'
import type { Customer } from '../types/models'

const mkCustomer = (o: Partial<Customer>): Customer => ({
  id: 'cu1', full_name: '某人', is_starred: false, client_source: null, primary_applicant_id: null,
  relationship_to_primary: null, birth_date: null, gender: null, passport_no: null, nationality: null, phone: null,
  email: null, wechat: null, address: null, sponsor_employer_id: null, sponsor_position: null, referrer_id: null, owner_referrer_id: null, notes: null,
  assigned_to: null, created_by: null, is_archived: false, created_at: '', updated_at: '', ...o,
})

describe('initialFormState（新建客户时用 ?primary= 预选主申请人，自动挂靠家庭组）', () => {
  it('新建 + 传入 initialPrimaryId → 预选该主申，保存后挂靠成立', () => {
    const s = initialFormState(undefined, 'head')
    expect(s.primary_applicant_id).toBe('head')
    expect(toPayload(s).primary_applicant_id).toBe('head')
  })

  it('新建、无 initialPrimaryId → 留空（= 本人是主申请人）', () => {
    const s = initialFormState(undefined, undefined)
    expect(s.primary_applicant_id).toBe('')
    expect(toPayload(s).primary_applicant_id).toBeNull()
  })

  it('编辑现有客户 → 用其自身的 primary_applicant_id，忽略传入的预选值', () => {
    const existing = mkCustomer({ id: 'sub', primary_applicant_id: 'realHead' })
    const s = initialFormState(existing, 'someoneElse')
    expect(s.primary_applicant_id).toBe('realHead')
  })
})

describe('归属人（owner_referrer_id：referrers.kind=owner 实体）', () => {
  it('编辑回填归属人；toPayload 透传', () => {
    const s = initialFormState(mkCustomer({ owner_referrer_id: 'o1' }))
    expect(s.owner_referrer_id).toBe('o1')
    expect(toPayload(s).owner_referrer_id).toBe('o1')
  })

  it('未选归属人 → null', () => {
    const s = initialFormState(undefined)
    expect(s.owner_referrer_id).toBe('')
    expect(toPayload(s).owner_referrer_id).toBeNull()
  })
})

describe('toPayload（副申请时才写关系，主申时清空关系字段）', () => {
  it('挂靠到主申 → primary_applicant_id + relationship 一起写入', () => {
    const s = { ...initialFormState(undefined, 'head'), relationship_to_primary: '配偶' }
    const p = toPayload(s)
    expect(p.primary_applicant_id).toBe('head')
    expect(p.relationship_to_primary).toBe('配偶')
  })

  it('本人是主申（无挂靠）→ relationship 强制清空', () => {
    const s = { ...initialFormState(undefined, undefined), relationship_to_primary: '配偶' }
    const p = toPayload(s)
    expect(p.primary_applicant_id).toBeNull()
    expect(p.relationship_to_primary).toBeNull()
  })
})
