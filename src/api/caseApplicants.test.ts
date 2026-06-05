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

describe('removeSelfFromCase（任何参与人在自己页面移出自己）', () => {
  it('普通成员：删自己的 case_applicants 行', async () => {
    const b = wireFrom(fromMock, {
      cases: { data: { customer_id: 'OWNER' } }, // 案件客户是别人
      case_applicants: { data: null },
    })
    await api.removeSelfFromCase('c1', 'cu9')
    expect(b.case_applicants.delete).toHaveBeenCalled()
    expect(b.case_applicants.eq).toHaveBeenCalledWith('customer_id', 'cu9')
    expect(b.cases.update).not.toHaveBeenCalled() // 不动案件
  })

  it('案件客户：过户给另一参与人（cases.customer_id 改写 + 该参与人移出参与表）', async () => {
    const b = wireFrom(fromMock, {
      cases: { data: { customer_id: 'cu1' } }, // 自己就是案件客户
      case_applicants: { data: [{ customer_id: 'cu2' }] }, // 还有参与人 cu2
    })
    await api.removeSelfFromCase('c1', 'cu1')
    expect(b.cases.update).toHaveBeenCalledWith({ customer_id: 'cu2' }) // 过户
    expect(b.case_applicants.neq).toHaveBeenCalledWith('customer_id', 'cu1')
    expect(b.case_applicants.delete).toHaveBeenCalled() // cu2 移出参与表（已成案件客户）
  })

  it('唯一参与人：拒绝并给出指引（案件不能没有人）', async () => {
    wireFrom(fromMock, {
      cases: { data: { customer_id: 'cu1' } },
      case_applicants: { data: [] }, // 没有其他参与人
    })
    await expect(api.removeSelfFromCase('c1', 'cu1')).rejects.toThrow(/唯一参与人/)
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
