import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from './immiAccounts'
import { wireFrom } from '../test/sbMock'

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { from: fromMock }, setRememberMe: vi.fn() }))

beforeEach(() => {
  fromMock.mockReset()
})

describe('listImmiAccounts', () => {
  it('默认排除归档，按 name 升序（可复用 lookup：多 case 共用同几个账号）', async () => {
    const b = wireFrom(fromMock, { immi_accounts: { data: [] } })
    await api.listImmiAccounts()
    expect(fromMock).toHaveBeenCalledWith('immi_accounts')
    expect(b.immi_accounts.eq).toHaveBeenCalledWith('is_archived', false)
    expect(b.immi_accounts.order).toHaveBeenCalledWith('name', { ascending: true })
  })

  it('includeArchived 时不加归档过滤', async () => {
    const b = wireFrom(fromMock, { immi_accounts: { data: [] } })
    await api.listImmiAccounts({ includeArchived: true })
    expect(b.immi_accounts.eq).not.toHaveBeenCalledWith('is_archived', false)
  })
})

describe('getImmiAccount', () => {
  it('按 id maybeSingle（案件详情解析账号名用）', async () => {
    const b = wireFrom(fromMock, { immi_accounts: { data: { id: 'acc1' } } })
    await api.getImmiAccount('acc1')
    expect(b.immi_accounts.eq).toHaveBeenCalledWith('id', 'acc1')
    expect(b.immi_accounts.maybeSingle).toHaveBeenCalled()
  })
})

describe('createImmiAccount', () => {
  it('插入并返回（select-or-create 的 create 路径）', async () => {
    const b = wireFrom(fromMock, { immi_accounts: { data: { id: 'acc1', name: 'IMMI 账号 A' } } })
    const created = await api.createImmiAccount({ name: 'IMMI 账号 A' })
    expect(b.immi_accounts.insert).toHaveBeenCalledWith(expect.objectContaining({ name: 'IMMI 账号 A' }))
    expect(created).toMatchObject({ id: 'acc1' })
  })
})
