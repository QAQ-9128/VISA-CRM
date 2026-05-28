import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as casesApi from './cases'
import { wireFrom } from '../test/sbMock'

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { from: fromMock }, setRememberMe: vi.fn() }))

beforeEach(() => {
  fromMock.mockReset()
})

describe('listCasesByCustomer', () => {
  it('按 customer_id 过滤、排除归档、按创建时间倒序', async () => {
    const rows = [{ id: 'c1' }]
    const b = wireFrom(fromMock, { cases: { data: rows } })
    const result = await casesApi.listCasesByCustomer('cust1')
    expect(fromMock).toHaveBeenCalledWith('cases')
    expect(b.cases.eq).toHaveBeenCalledWith('customer_id', 'cust1')
    expect(b.cases.eq).toHaveBeenCalledWith('is_archived', false)
    expect(b.cases.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(result).toEqual(rows)
  })
})

describe('getCase', () => {
  it('按 id maybeSingle', async () => {
    const row = { id: 'c1', visa_subclass: '482' }
    const b = wireFrom(fromMock, { cases: { data: row } })
    const result = await casesApi.getCase('c1')
    expect(b.cases.eq).toHaveBeenCalledWith('id', 'c1')
    expect(b.cases.maybeSingle).toHaveBeenCalled()
    expect(result).toEqual(row)
  })
})

describe('createCase', () => {
  it('插入并返回新案件', async () => {
    const row = { id: 'new', customer_id: 'cust1', visa_subclass: '189' }
    const b = wireFrom(fromMock, { cases: { data: row } })
    const result = await casesApi.createCase({ customer_id: 'cust1', visa_subclass: '189' })
    expect(b.cases.insert).toHaveBeenCalledWith({ customer_id: 'cust1', visa_subclass: '189' })
    expect(result).toEqual(row)
  })
})

describe('updateCase', () => {
  it('按 id 更新非阶段字段', async () => {
    const row = { id: 'c1', visa_subclass: '190' }
    const b = wireFrom(fromMock, { cases: { data: row } })
    await casesApi.updateCase('c1', { visa_subclass: '190' })
    expect(b.cases.update).toHaveBeenCalledWith({ visa_subclass: '190' })
    expect(b.cases.eq).toHaveBeenCalledWith('id', 'c1')
  })
})

describe('updateCaseStage', () => {
  it('更新 current_stage 并写一条 case_stage_history', async () => {
    const updated = { id: 'c1', current_stage: 'nomination_lodged' }
    const b = wireFrom(fromMock, { cases: { data: updated }, case_stage_history: {} })

    const result = await casesApi.updateCaseStage({
      caseId: 'c1',
      fromStage: 'todo',
      toStage: 'nomination_lodged',
      note: '已递提名',
      changedBy: 'u1',
    })

    expect(b.cases.update).toHaveBeenCalledWith({ current_stage: 'nomination_lodged' })
    expect(b.cases.eq).toHaveBeenCalledWith('id', 'c1')
    expect(b.case_stage_history.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        case_id: 'c1',
        from_stage: 'todo',
        to_stage: 'nomination_lodged',
        note: '已递提名',
        changed_by: 'u1',
      }),
    )
    expect(result).toEqual(updated)
  })
})

describe('archiveCase', () => {
  it('软删除：update({is_archived:true})，不 delete', async () => {
    const b = wireFrom(fromMock, { cases: {} })
    await casesApi.archiveCase('c1')
    expect(b.cases.update).toHaveBeenCalledWith({ is_archived: true })
    expect(b.cases.eq).toHaveBeenCalledWith('id', 'c1')
    expect(b.cases.delete).not.toHaveBeenCalled()
  })
})

describe('getCaseStageHistory', () => {
  it('按 case_id 取历史、按时间倒序', async () => {
    const b = wireFrom(fromMock, { case_stage_history: { data: [] } })
    await casesApi.getCaseStageHistory('c1')
    expect(fromMock).toHaveBeenCalledWith('case_stage_history')
    expect(b.case_stage_history.eq).toHaveBeenCalledWith('case_id', 'c1')
    expect(b.case_stage_history.order).toHaveBeenCalledWith('changed_at', { ascending: false })
  })
})
