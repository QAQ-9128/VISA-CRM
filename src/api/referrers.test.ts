import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from './referrers'
import { wireFrom } from '../test/sbMock'

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { from: fromMock }, setRememberMe: vi.fn() }))

beforeEach(() => {
  fromMock.mockReset()
})

describe('listReferrers', () => {
  it('默认排除归档，按 name 升序', async () => {
    const b = wireFrom(fromMock, { referrers: { data: [] } })
    await api.listReferrers()
    expect(fromMock).toHaveBeenCalledWith('referrers')
    expect(b.referrers.eq).toHaveBeenCalledWith('is_archived', false)
    expect(b.referrers.order).toHaveBeenCalledWith('name', { ascending: true })
  })

  it('includeArchived 时不加归档过滤', async () => {
    const b = wireFrom(fromMock, { referrers: { data: [] } })
    await api.listReferrers({ includeArchived: true })
    expect(b.referrers.eq).not.toHaveBeenCalledWith('is_archived', false)
  })
})

describe('getReferrer', () => {
  it('按 id maybeSingle', async () => {
    const b = wireFrom(fromMock, { referrers: { data: { id: 'r1' } } })
    await api.getReferrer('r1')
    expect(b.referrers.eq).toHaveBeenCalledWith('id', 'r1')
    expect(b.referrers.maybeSingle).toHaveBeenCalled()
  })
})

describe('createReferrer', () => {
  it('插入并返回', async () => {
    const b = wireFrom(fromMock, { referrers: { data: { id: 'r1' } } })
    await api.createReferrer({ name: '王介绍' })
    expect(b.referrers.insert).toHaveBeenCalledWith(expect.objectContaining({ name: '王介绍' }))
  })
})

describe('updateReferrer', () => {
  it('按 id 更新', async () => {
    const b = wireFrom(fromMock, { referrers: { data: { id: 'r1' } } })
    await api.updateReferrer('r1', { contact_phone: '0400000000' })
    expect(b.referrers.update).toHaveBeenCalledWith({ contact_phone: '0400000000' })
    expect(b.referrers.eq).toHaveBeenCalledWith('id', 'r1')
  })
})

describe('archiveReferrer', () => {
  it('软删除：update({is_archived:true})，不 delete', async () => {
    const b = wireFrom(fromMock, { referrers: {} })
    await api.archiveReferrer('r1')
    expect(b.referrers.update).toHaveBeenCalledWith({ is_archived: true })
    expect(b.referrers.delete).not.toHaveBeenCalled()
  })
})
