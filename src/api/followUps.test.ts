import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from './followUps'
import { wireFrom } from '../test/sbMock'

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { from: fromMock }, setRememberMe: vi.fn() }))

beforeEach(() => {
  fromMock.mockReset()
})

describe('listFollowUpsByCustomer', () => {
  it('按 customer_id、时间倒序', async () => {
    const b = wireFrom(fromMock, { follow_ups: { data: [] } })
    await api.listFollowUpsByCustomer('cu1')
    expect(fromMock).toHaveBeenCalledWith('follow_ups')
    expect(b.follow_ups.eq).toHaveBeenCalledWith('customer_id', 'cu1')
    expect(b.follow_ups.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })
})

describe('listFollowUpsByCase', () => {
  it('按 case_id', async () => {
    const b = wireFrom(fromMock, { follow_ups: { data: [] } })
    await api.listFollowUpsByCase('ca1')
    expect(b.follow_ups.eq).toHaveBeenCalledWith('case_id', 'ca1')
  })
})

describe('createFollowUp', () => {
  it('插入并返回', async () => {
    const b = wireFrom(fromMock, { follow_ups: { data: { id: 'f1' } } })
    await api.createFollowUp({ customer_id: 'cu1', channel: 'call', content: '电话沟通' })
    expect(b.follow_ups.insert).toHaveBeenCalledWith(
      expect.objectContaining({ customer_id: 'cu1', channel: 'call', content: '电话沟通' }),
    )
  })
})

describe('deleteFollowUp', () => {
  it('按 id 删除', async () => {
    const b = wireFrom(fromMock, { follow_ups: {} })
    await api.deleteFollowUp('f1')
    expect(b.follow_ups.delete).toHaveBeenCalled()
    expect(b.follow_ups.eq).toHaveBeenCalledWith('id', 'f1')
  })
})
