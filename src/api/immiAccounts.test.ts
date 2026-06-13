import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from './immiAccounts'
import { makeBuilder, wireFrom } from '../test/sbMock'
import type { SbResult } from '../test/sbMock'

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

describe('countCasesUsingImmiAccount（删除前用量提示）', () => {
  it('按 immi_account_id 做 head+count 精确计数', async () => {
    const cases = makeBuilder({ data: null, error: null, count: 3 } as unknown as SbResult)
    fromMock.mockReturnValue(cases)
    const n = await api.countCasesUsingImmiAccount('acc1')
    expect(fromMock).toHaveBeenCalledWith('cases')
    expect(cases.select).toHaveBeenCalledWith('id', { count: 'exact', head: true })
    expect(cases.eq).toHaveBeenCalledWith('immi_account_id', 'acc1')
    expect(n).toBe(3)
  })
})

describe('deleteImmiAccount（置空案件引用 + 归档账号，均走 update）', () => {
  it('先把引用案件 immi_account_id 置空，再 is_archived=true（不硬删）', async () => {
    const b = wireFrom(fromMock, { cases: { data: null }, immi_accounts: { data: null } })
    await api.deleteImmiAccount('acc1')
    expect(b.cases.update).toHaveBeenCalledWith({ immi_account_id: null })
    expect(b.cases.eq).toHaveBeenCalledWith('immi_account_id', 'acc1')
    expect(b.immi_accounts.update).toHaveBeenCalledWith({ is_archived: true })
    expect(b.immi_accounts.eq).toHaveBeenCalledWith('id', 'acc1')
  })
})
