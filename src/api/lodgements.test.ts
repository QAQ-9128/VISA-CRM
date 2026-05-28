import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as lodgementsApi from './lodgements'
import { wireFrom } from '../test/sbMock'

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { from: fromMock }, setRememberMe: vi.fn() }))

beforeEach(() => {
  fromMock.mockReset()
})

describe('listByCase', () => {
  it('按 case_id 取该案件的递交记录', async () => {
    const rows = [{ id: 'l1', type: 'nomination' }]
    const b = wireFrom(fromMock, { lodgements: { data: rows } })
    const result = await lodgementsApi.listByCase('c1')
    expect(fromMock).toHaveBeenCalledWith('lodgements')
    expect(b.lodgements.eq).toHaveBeenCalledWith('case_id', 'c1')
    expect(result).toEqual(rows)
  })
})

describe('createLodgement', () => {
  it('插入并返回（type 决定 nomination/visa）', async () => {
    const row = { id: 'l1', case_id: 'c1', type: 'visa' }
    const b = wireFrom(fromMock, { lodgements: { data: row } })
    const result = await lodgementsApi.createLodgement({ case_id: 'c1', type: 'visa' })
    expect(b.lodgements.insert).toHaveBeenCalledWith({ case_id: 'c1', type: 'visa' })
    expect(result).toEqual(row)
  })
})

describe('updateLodgement', () => {
  it('按 id 更新递交字段', async () => {
    const row = { id: 'l1', dha_processing_days: 120 }
    const b = wireFrom(fromMock, { lodgements: { data: row } })
    await lodgementsApi.updateLodgement('l1', {
      lodged_date: '2026-01-01',
      reference_number: 'REF-1',
      dha_processing_days: 120,
      outcome: 'pending',
    })
    expect(b.lodgements.update).toHaveBeenCalledWith(
      expect.objectContaining({ dha_processing_days: 120, reference_number: 'REF-1' }),
    )
    expect(b.lodgements.eq).toHaveBeenCalledWith('id', 'l1')
  })
})
