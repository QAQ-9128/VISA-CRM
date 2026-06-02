import { describe, expect, it } from 'vitest'
import {
  recordDate,
  sortRecords,
  sortRecordsAsc,
  filterRecordsByType,
  recordStats,
  selectPendingTasks,
} from './records'
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

describe('sortRecordsAsc', () => {
  it('最早在上（sortRecords 反序）', () => {
    const ids = sortRecordsAsc([
      mk({ id: 't_early', type: 'task', due_date: '2026-05-09' }),
      mk({ id: 't_late', type: 'task', is_done: true, done_at: '2026-05-12T08:00:00Z' }),
      mk({ id: 'f_mid', type: 'follow_up', created_at: '2026-05-10T03:00:00Z' }),
    ]).map((x) => x.id)
    expect(ids).toEqual(['t_early', 'f_mid', 't_late'])
  })
})

describe('filterRecordsByType', () => {
  const rows = [
    mk({ id: 'a', type: 'task' }),
    mk({ id: 'b', type: 'follow_up' }),
    mk({ id: 'c', type: 'task' }),
  ]
  it('全部不过滤；按 task / follow_up 过滤', () => {
    expect(filterRecordsByType(rows, 'all').map((r) => r.id)).toEqual(['a', 'b', 'c'])
    expect(filterRecordsByType(rows, 'task').map((r) => r.id)).toEqual(['a', 'c'])
    expect(filterRecordsByType(rows, 'follow_up').map((r) => r.id)).toEqual(['b'])
  })
})

describe('recordStats', () => {
  const TODAY = new Date('2026-06-01T00:00:00Z')
  it('总数 / 近 7 天新增 / 未完成待办', () => {
    const s = recordStats(
      [
        mk({ id: 'a', type: 'task', is_done: false, created_at: '2026-05-30T00:00:00Z' }), // 本周, 未完成待办
        mk({ id: 'b', type: 'task', is_done: true, created_at: '2026-05-31T00:00:00Z' }), // 本周, 已完成
        mk({ id: 'c', type: 'follow_up', created_at: '2026-05-01T00:00:00Z' }), // 不在本周
        mk({ id: 'd', type: 'task', is_done: false, created_at: '2026-04-01T00:00:00Z' }), // 旧的未完成待办
      ],
      TODAY,
    )
    expect(s).toEqual({ total: 4, thisWeek: 2, pending: 2 })
  })
  it('空 → 全 0', () => {
    expect(recordStats([], TODAY)).toEqual({ total: 0, thisWeek: 0, pending: 0 })
  })
})

describe('selectPendingTasks', () => {
  it('仅未完成待办，按截止日升序（有截止日在前）', () => {
    const ids = selectPendingTasks([
      mk({ id: 'done', type: 'task', is_done: true, due_date: '2026-05-01' }),
      mk({ id: 'follow', type: 'follow_up' }),
      mk({ id: 'late', type: 'task', is_done: false, due_date: '2026-07-01' }),
      mk({ id: 'soon', type: 'task', is_done: false, due_date: '2026-06-10' }),
      mk({ id: 'nodue', type: 'task', is_done: false, due_date: null }),
    ]).map((r) => r.id)
    expect(ids).toEqual(['soon', 'late', 'nodue'])
  })
})
