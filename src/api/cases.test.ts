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

  it('不按 is_archived 过滤 → 已归档的主案件仍能取到（副案件徽章可继续展示）', async () => {
    const b = wireFrom(fromMock, { cases: { data: { id: 'c1', is_archived: true } } })
    await casesApi.getCase('c1')
    expect(b.cases.eq).not.toHaveBeenCalledWith('is_archived', expect.anything())
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

  it('带 parent_case_id 创建 → 原样写入（软关联）', async () => {
    const b = wireFrom(fromMock, { cases: { data: { id: 'sub' } } })
    await casesApi.createCase({ customer_id: 'cust2', visa_subclass: '482', parent_case_id: 'parent1' })
    expect(b.cases.insert).toHaveBeenCalledWith(
      expect.objectContaining({ parent_case_id: 'parent1' }),
    )
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

  it('可设置 / 清空 parent_case_id', async () => {
    const b1 = wireFrom(fromMock, { cases: { data: { id: 'c1' } } })
    await casesApi.updateCase('c1', { parent_case_id: 'p1' })
    expect(b1.cases.update).toHaveBeenCalledWith({ parent_case_id: 'p1' })

    const b2 = wireFrom(fromMock, { cases: { data: { id: 'c1' } } })
    await casesApi.updateCase('c1', { parent_case_id: null })
    expect(b2.cases.update).toHaveBeenCalledWith({ parent_case_id: null })
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

  it('阶段流转只写 current_stage、只改本案件行，绝不触碰 parent_case_id（主↔副阶段互不传染）', async () => {
    const b = wireFrom(fromMock, { cases: { data: { id: 'parent' } }, case_stage_history: {} })
    await casesApi.updateCaseStage({ caseId: 'parent', fromStage: 'todo', toStage: 'granted' })
    // 更新载荷只有 current_stage —— 关系字段不在其中
    expect(b.cases.update).toHaveBeenCalledWith({ current_stage: 'granted' })
    expect(b.cases.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ parent_case_id: expect.anything() }),
    )
    // 只按本案件 id 更新，不会去改副案件
    expect(b.cases.eq).toHaveBeenCalledWith('id', 'parent')
  })

  it('传 effectiveAt 时写入 effective_at（事后补录过去日期）', async () => {
    const b = wireFrom(fromMock, { cases: { data: { id: 'c1' } }, case_stage_history: {} })
    await casesApi.updateCaseStage({
      caseId: 'c1',
      fromStage: 'todo',
      toStage: 'nomination_lodged',
      effectiveAt: '2026-05-20T09:00:00.000Z',
    })
    expect(b.case_stage_history.insert).toHaveBeenCalledWith(
      expect.objectContaining({ effective_at: '2026-05-20T09:00:00.000Z' }),
    )
  })
})

describe('updateStageHistory', () => {
  it('按 id UPDATE 实际发生时间，绝不 INSERT', async () => {
    const b = wireFrom(fromMock, { case_stage_history: { data: { id: 'h1' } } })
    await casesApi.updateStageHistory('h1', { effective_at: '2026-05-20T09:00:00.000Z' })
    expect(b.case_stage_history.update).toHaveBeenCalledWith({ effective_at: '2026-05-20T09:00:00.000Z' })
    expect(b.case_stage_history.eq).toHaveBeenCalledWith('id', 'h1')
    expect(b.case_stage_history.insert).not.toHaveBeenCalled()
  })
})

describe('deleteStageHistory', () => {
  it('按 id DELETE，不改 cases、不 INSERT', async () => {
    const b = wireFrom(fromMock, { case_stage_history: {} })
    await casesApi.deleteStageHistory('h1')
    expect(b.case_stage_history.delete).toHaveBeenCalled()
    expect(b.case_stage_history.eq).toHaveBeenCalledWith('id', 'h1')
    expect(b.case_stage_history.insert).not.toHaveBeenCalled()
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

describe('deleteCase', () => {
  it('彻底删除：真 delete().eq(id)，不是软删', async () => {
    const b = wireFrom(fromMock, { cases: {} })
    await casesApi.deleteCase('c1')
    expect(b.cases.delete).toHaveBeenCalled()
    expect(b.cases.eq).toHaveBeenCalledWith('id', 'c1')
    expect(b.cases.update).not.toHaveBeenCalled()
  })
})

describe('getCaseStageHistory', () => {
  it('按 case_id 取历史、按时间倒序', async () => {
    const b = wireFrom(fromMock, { case_stage_history: { data: [] } })
    await casesApi.getCaseStageHistory('c1')
    expect(fromMock).toHaveBeenCalledWith('case_stage_history')
    expect(b.case_stage_history.eq).toHaveBeenCalledWith('case_id', 'c1')
    expect(b.case_stage_history.order).toHaveBeenCalledWith('effective_at', { ascending: false })
  })
})
