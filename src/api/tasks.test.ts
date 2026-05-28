import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from './tasks'
import { wireFrom } from '../test/sbMock'

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { from: fromMock }, setRememberMe: vi.fn() }))

beforeEach(() => {
  fromMock.mockReset()
})

describe('listTasksByCustomer / byCase', () => {
  it('按归属过滤', async () => {
    const b1 = wireFrom(fromMock, { tasks: { data: [] } })
    await api.listTasksByCustomer('cu1')
    expect(fromMock).toHaveBeenCalledWith('tasks')
    expect(b1.tasks.eq).toHaveBeenCalledWith('customer_id', 'cu1')

    const b2 = wireFrom(fromMock, { tasks: { data: [] } })
    await api.listTasksByCase('ca1')
    expect(b2.tasks.eq).toHaveBeenCalledWith('case_id', 'ca1')
  })
})

describe('createTask', () => {
  it('插入并返回', async () => {
    const b = wireFrom(fromMock, { tasks: { data: { id: 't1' } } })
    await api.createTask({ title: '准备材料', customer_id: 'cu1' })
    expect(b.tasks.insert).toHaveBeenCalledWith(
      expect.objectContaining({ title: '准备材料', customer_id: 'cu1' }),
    )
  })
})

describe('updateTask', () => {
  it('切换完成', async () => {
    const b = wireFrom(fromMock, { tasks: { data: { id: 't1' } } })
    await api.updateTask('t1', { is_done: true, done_at: '2026-01-01T00:00:00Z' })
    expect(b.tasks.update).toHaveBeenCalledWith({ is_done: true, done_at: '2026-01-01T00:00:00Z' })
    expect(b.tasks.eq).toHaveBeenCalledWith('id', 't1')
  })
})

describe('deleteTask', () => {
  it('按 id 删除', async () => {
    const b = wireFrom(fromMock, { tasks: {} })
    await api.deleteTask('t1')
    expect(b.tasks.delete).toHaveBeenCalled()
    expect(b.tasks.eq).toHaveBeenCalledWith('id', 't1')
  })
})

describe('getOpenTasks', () => {
  it('只取未完成', async () => {
    const b = wireFrom(fromMock, { tasks: { data: [] } })
    await api.getOpenTasks()
    expect(b.tasks.eq).toHaveBeenCalledWith('is_done', false)
  })
})
