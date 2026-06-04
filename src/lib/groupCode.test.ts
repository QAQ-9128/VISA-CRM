import { describe, expect, it } from 'vitest'
import { groupCode, groupCodeOf } from './groupCode'
import type { Customer } from '../types/models'

const mkCust = (o: Partial<Customer>): Customer => ({
  id: 'c1', full_name: '甲', birth_date: null, gender: null, passport_no: null, nationality: null,
  phone: null, email: null, wechat: null, address: null, sponsor_employer_id: null, sponsor_position: null,
  referrer_id: null, primary_applicant_id: null, relationship_to_primary: null, client_source: null,
  is_starred: false, notes: null, assigned_to: null, created_by: null, is_archived: false,
  created_at: '', updated_at: '', ...o,
})

describe('groupCode', () => {
  it('确定性：同一 id 永远同码', () => {
    expect(groupCode('abc-123')).toBe(groupCode('abc-123'))
  })
  it('格式：G- 前缀 + 4 位', () => {
    expect(groupCode('any-root-id')).toMatch(/^G-[0-9A-Z]{4}$/)
  })
  it('不同根通常不同码', () => {
    expect(groupCode('root-a')).not.toBe(groupCode('root-b'))
  })
  it('空 id → G-0000', () => {
    expect(groupCode('')).toBe('G-0000')
  })
})

describe('groupCodeOf', () => {
  it('主申：用自身 id；副申：用主申 id → 同组同码', () => {
    const primary = mkCust({ id: 'P', primary_applicant_id: null })
    const sub = mkCust({ id: 'S', primary_applicant_id: 'P' })
    expect(groupCodeOf(primary)).toBe(groupCodeOf(sub)) // 同组
    expect(groupCodeOf(primary)).toBe(groupCode('P'))
  })
  it('两个独立主申不同组、不同码', () => {
    expect(groupCodeOf(mkCust({ id: 'A' }))).not.toBe(groupCodeOf(mkCust({ id: 'B' })))
  })
})
