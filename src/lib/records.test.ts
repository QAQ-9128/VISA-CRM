import { describe, expect, it } from 'vitest'
import { recordDate, sortRecords } from './records'
import type { RecordRow } from '../types/models'

const mk = (o: Partial<RecordRow>): RecordRow => ({
  id: 'r', customer_id: 'cu1', case_id: null, type: 'task', content: '内容', due_date: null,
  is_done: false, done_at: null, assigned_to: null, channel: null, emoji_marker: null,
  created_by: 'u1', created_at: '2026-01-01T00:00:00Z', updated_at: '', ...o,
})

describe('recordDate', () => {
  it('待办：完成用 done_at，未完成用 due_date，都缺用 created_at', () => {
    expect(recordDate(mk({ type: 'task', is_done: true, done_at: '2026-05-12T08:00:00Z', due_date: '2026-05-01' }))).toBe('2026-05-12T08:00:00Z')
    expect(recordDate(mk({ type: 'task', is_done: false, due_date: '2026-05-09' }))).toBe('2026-05-09')
    expect(recordDate(mk({ type: 'task', due_date: null, created_at: '2026-05-15T00:00:00Z' }))).toBe('2026-05-15T00:00:00Z')
  })
  it('跟进：用 created_at', () => {
    expect(recordDate(mk({ type: 'follow_up', created_at: '2026-05-10T03:00:00Z' }))).toBe('2026-05-10T03:00:00Z')
  })
})

describe('sortRecords', () => {
  it('无数据 → 空', () => {
    expect(sortRecords([])).toEqual([])
  })
  it('按相关日期倒序，待办/跟进混排、跨日正确', () => {
    const r = sortRecords([
      mk({ id: 't_early', type: 'task', due_date: '2026-05-09' }),
      mk({ id: 't_late', type: 'task', is_done: true, done_at: '2026-05-12T08:00:00Z' }),
      mk({ id: 'f_mid', type: 'follow_up', created_at: '2026-05-10T03:00:00Z' }),
    ])
    expect(r.map((x) => x.id)).toEqual(['t_late', 'f_mid', 't_early'])
  })
  it('不改原数组', () => {
    const arr = [mk({ id: 'a' }), mk({ id: 'b' })]
    sortRecords(arr)
    expect(arr.map((x) => x.id)).toEqual(['a', 'b'])
  })
})
