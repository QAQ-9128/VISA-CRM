import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from './employers'
import { wireFrom } from '../test/sbMock'

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { from: fromMock }, setRememberMe: vi.fn() }))

beforeEach(() => {
  fromMock.mockReset()
})

describe('listEmployers', () => {
  it('默认排除归档，按 name 升序', async () => {
    const b = wireFrom(fromMock, { employers: { data: [] } })
    await api.listEmployers()
    expect(fromMock).toHaveBeenCalledWith('employers')
    expect(b.employers.eq).toHaveBeenCalledWith('is_archived', false)
    expect(b.employers.order).toHaveBeenCalledWith('name', { ascending: true })
  })

  it('includeArchived 时不加归档过滤', async () => {
    const b = wireFrom(fromMock, { employers: { data: [] } })
    await api.listEmployers({ includeArchived: true })
    expect(b.employers.eq).not.toHaveBeenCalledWith('is_archived', false)
  })
})

describe('getEmployer', () => {
  it('按 id maybeSingle', async () => {
    const b = wireFrom(fromMock, { employers: { data: { id: 'e1' } } })
    await api.getEmployer('e1')
    expect(b.employers.eq).toHaveBeenCalledWith('id', 'e1')
    expect(b.employers.maybeSingle).toHaveBeenCalled()
  })
})

describe('createEmployer', () => {
  it('插入并返回', async () => {
    const b = wireFrom(fromMock, { employers: { data: { id: 'e1' } } })
    await api.createEmployer({ name: 'ACME Pty Ltd' })
    expect(b.employers.insert).toHaveBeenCalledWith(expect.objectContaining({ name: 'ACME Pty Ltd' }))
  })
})

describe('updateEmployer', () => {
  it('按 id 更新', async () => {
    const b = wireFrom(fromMock, { employers: { data: { id: 'e1' } } })
    await api.updateEmployer('e1', { abn: '12345' })
    expect(b.employers.update).toHaveBeenCalledWith({ abn: '12345' })
    expect(b.employers.eq).toHaveBeenCalledWith('id', 'e1')
  })
})

describe('archiveEmployer', () => {
  it('软删除：update({is_archived:true})，不 delete', async () => {
    const b = wireFrom(fromMock, { employers: {} })
    await api.archiveEmployer('e1')
    expect(b.employers.update).toHaveBeenCalledWith({ is_archived: true })
    expect(b.employers.delete).not.toHaveBeenCalled()
  })
})

describe('deleteEmployer', () => {
  it('彻底删除：真 delete().eq(id)', async () => {
    const b = wireFrom(fromMock, { employers: {} })
    await api.deleteEmployer('e1')
    expect(b.employers.delete).toHaveBeenCalled()
    expect(b.employers.eq).toHaveBeenCalledWith('id', 'e1')
    expect(b.employers.update).not.toHaveBeenCalled()
  })
})
