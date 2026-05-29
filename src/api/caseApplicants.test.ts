import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from './caseApplicants'
import { wireFrom } from '../test/sbMock'

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { from: fromMock }, setRememberMe: vi.fn() }))

beforeEach(() => {
  fromMock.mockReset()
})

describe('listCaseApplicants', () => {
  it('按 case_id 取该案件的副申请人关联', async () => {
    const b = wireFrom(fromMock, { case_applicants: { data: [] } })
    await api.listCaseApplicants('c1')
    expect(fromMock).toHaveBeenCalledWith('case_applicants')
    expect(b.case_applicants.eq).toHaveBeenCalledWith('case_id', 'c1')
  })
})

describe('listAllCaseApplicants', () => {
  it('取全部案件申请人关联（财务/案件表用）', async () => {
    const b = wireFrom(fromMock, { case_applicants: { data: [] } })
    await api.listAllCaseApplicants()
    expect(fromMock).toHaveBeenCalledWith('case_applicants')
    expect(b.case_applicants.select).toHaveBeenCalledWith('*')
  })
})

describe('setCaseApplicants', () => {
  it('先删该案件旧关联，再插入选中的客户', async () => {
    const b = wireFrom(fromMock, { case_applicants: { data: null } })
    await api.setCaseApplicants('c1', ['cu2', 'cu3'])
    expect(b.case_applicants.delete).toHaveBeenCalled()
    expect(b.case_applicants.eq).toHaveBeenCalledWith('case_id', 'c1')
    expect(b.case_applicants.insert).toHaveBeenCalledWith([
      { case_id: 'c1', customer_id: 'cu2' },
      { case_id: 'c1', customer_id: 'cu3' },
    ])
  })

  it('空列表时只删除、不插入', async () => {
    const b = wireFrom(fromMock, { case_applicants: { data: null } })
    await api.setCaseApplicants('c1', [])
    expect(b.case_applicants.delete).toHaveBeenCalled()
    expect(b.case_applicants.insert).not.toHaveBeenCalled()
  })
})

describe('addCaseApplicant', () => {
  it('插入单条 (case_id, customer_id) 关联', async () => {
    const b = wireFrom(fromMock, { case_applicants: { data: null } })
    await api.addCaseApplicant('c1', 'cu9')
    expect(fromMock).toHaveBeenCalledWith('case_applicants')
    expect(b.case_applicants.insert).toHaveBeenCalledWith({ case_id: 'c1', customer_id: 'cu9' })
  })
})

describe('removeCaseApplicant', () => {
  it('按 (case_id, customer_id) 删除单条关联', async () => {
    const b = wireFrom(fromMock, { case_applicants: { data: null } })
    await api.removeCaseApplicant('c1', 'cu9')
    expect(b.case_applicants.delete).toHaveBeenCalled()
    expect(b.case_applicants.eq).toHaveBeenCalledWith('case_id', 'c1')
    expect(b.case_applicants.eq).toHaveBeenCalledWith('customer_id', 'cu9')
  })
})
