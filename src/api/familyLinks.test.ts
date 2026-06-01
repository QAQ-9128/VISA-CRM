import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from './familyLinks'
import { wireFrom } from '../test/sbMock'

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { from: fromMock }, setRememberMe: vi.fn() }))

beforeEach(() => fromMock.mockReset())

describe('family_member_links api', () => {
  it('listFamilyLinks 取全部', async () => {
    const b = wireFrom(fromMock, { family_member_links: { data: [] } })
    await api.listFamilyLinks()
    expect(fromMock).toHaveBeenCalledWith('family_member_links')
    expect(b.family_member_links.select).toHaveBeenCalledWith('*')
  })

  it('createFamilyLink 插入 primary/member/relationship', async () => {
    const b = wireFrom(fromMock, { family_member_links: { data: { id: 'l1' } } })
    await api.createFamilyLink({ primary_customer_id: 'A', member_customer_id: 'B', relationship: '配偶' })
    expect(b.family_member_links.insert).toHaveBeenCalledWith({
      primary_customer_id: 'A', member_customer_id: 'B', relationship: '配偶',
    })
  })

  it('deleteFamilyLink 按 id 真删', async () => {
    const b = wireFrom(fromMock, { family_member_links: {} })
    await api.deleteFamilyLink('l1')
    expect(b.family_member_links.delete).toHaveBeenCalled()
    expect(b.family_member_links.eq).toHaveBeenCalledWith('id', 'l1')
  })
})
