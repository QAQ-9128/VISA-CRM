import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from './checklist'
import { wireFrom } from '../test/sbMock'

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { from: fromMock }, setRememberMe: vi.fn() }))

beforeEach(() => {
  fromMock.mockReset()
})

describe('listChecklist', () => {
  it('取全部，按 created_at 升序', async () => {
    const b = wireFrom(fromMock, { checklist_items: { data: [] } })
    await api.listChecklist()
    expect(fromMock).toHaveBeenCalledWith('checklist_items')
    expect(b.checklist_items.order).toHaveBeenCalledWith('created_at', { ascending: true })
  })
})

describe('createChecklistItem', () => {
  it('插入一句话（content）', async () => {
    const b = wireFrom(fromMock, { checklist_items: { data: { id: 'x1' } } })
    await api.createChecklistItem('打电话给移民局')
    expect(b.checklist_items.insert).toHaveBeenCalledWith({ content: '打电话给移民局' })
  })
})

describe('setChecklistDone', () => {
  it('按 id 改勾选状态', async () => {
    const b = wireFrom(fromMock, { checklist_items: { data: { id: 'x1' } } })
    await api.setChecklistDone('x1', true)
    expect(b.checklist_items.update).toHaveBeenCalledWith({ is_done: true })
    expect(b.checklist_items.eq).toHaveBeenCalledWith('id', 'x1')
  })
})

describe('deleteChecklistItem', () => {
  it('真删该项', async () => {
    const b = wireFrom(fromMock, { checklist_items: {} })
    await api.deleteChecklistItem('x1')
    expect(b.checklist_items.delete).toHaveBeenCalled()
    expect(b.checklist_items.eq).toHaveBeenCalledWith('id', 'x1')
  })
})
