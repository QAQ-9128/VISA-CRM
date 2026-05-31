import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from './records'
import { wireFrom } from '../test/sbMock'

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { from: fromMock }, setRememberMe: vi.fn() }))

beforeEach(() => {
  fromMock.mockReset()
})

describe('listRecordsByCustomer / byCase', () => {
  it('按归属过滤', async () => {
    const b1 = wireFrom(fromMock, { records: { data: [] } })
    await api.listRecordsByCustomer('cu1')
    expect(fromMock).toHaveBeenCalledWith('records')
    expect(b1.records.eq).toHaveBeenCalledWith('customer_id', 'cu1')

    const b2 = wireFrom(fromMock, { records: { data: [] } })
    await api.listRecordsByCase('ca1')
    expect(b2.records.eq).toHaveBeenCalledWith('case_id', 'ca1')
  })
})

describe('getOpenTaskRecords', () => {
  it('只取 type=task 且未完成', async () => {
    const b = wireFrom(fromMock, { records: { data: [] } })
    await api.getOpenTaskRecords()
    expect(b.records.eq).toHaveBeenCalledWith('type', 'task')
    expect(b.records.eq).toHaveBeenCalledWith('is_done', false)
  })
})

describe('getOpenRecords', () => {
  it('取全部未完成记录（含跟进），不按类型过滤', async () => {
    const b = wireFrom(fromMock, { records: { data: [] } })
    await api.getOpenRecords()
    expect(b.records.eq).toHaveBeenCalledWith('is_done', false)
    expect(b.records.eq).not.toHaveBeenCalledWith('type', 'task')
  })
})

describe('createRecord', () => {
  it('插入并返回', async () => {
    const b = wireFrom(fromMock, { records: { data: { id: 'r1' } } })
    await api.createRecord({ customer_id: 'cu1', type: 'task', content: '准备材料' })
    expect(b.records.insert).toHaveBeenCalledWith(
      expect.objectContaining({ customer_id: 'cu1', type: 'task', content: '准备材料' }),
    )
  })
})

describe('updateRecord', () => {
  it('按 id UPDATE（含类型切换），绝不 INSERT', async () => {
    const b = wireFrom(fromMock, { records: { data: { id: 'r1' } } })
    await api.updateRecord('r1', { type: 'follow_up', emoji_marker: '⚠️', due_date: null })
    expect(b.records.update).toHaveBeenCalledWith({ type: 'follow_up', emoji_marker: '⚠️', due_date: null })
    expect(b.records.eq).toHaveBeenCalledWith('id', 'r1')
    expect(b.records.insert).not.toHaveBeenCalled()
  })
})

describe('deleteRecord', () => {
  it('按 id DELETE，不 INSERT', async () => {
    const b = wireFrom(fromMock, { records: {} })
    await api.deleteRecord('r1')
    expect(b.records.delete).toHaveBeenCalled()
    expect(b.records.eq).toHaveBeenCalledWith('id', 'r1')
    expect(b.records.insert).not.toHaveBeenCalled()
  })
})
