import { describe, expect, it } from 'vitest'
import { isTaskOverdue, selectCaseTasks, selectMyOpenTasks } from './tasks'
import type { Task } from '../types/models'

const TODAY = new Date(2026, 0, 15)

const mk = (o: Partial<Task>): Task => ({
  id: 't',
  customer_id: null,
  case_id: null,
  title: '待办',
  due_date: null,
  is_done: false,
  done_at: null,
  assigned_to: 'me',
  created_by: null,
  created_at: '',
  updated_at: '',
  ...o,
})

describe('isTaskOverdue', () => {
  it('已完成 → false', () => expect(isTaskOverdue('2026-01-01', true, TODAY)).toBe(false))
  it('无截止 → false', () => expect(isTaskOverdue(null, false, TODAY)).toBe(false))
  it('过期未完成 → true', () => expect(isTaskOverdue('2026-01-01', false, TODAY)).toBe(true))
  it('未来未完成 → false', () => expect(isTaskOverdue('2026-02-01', false, TODAY)).toBe(false))
})

describe('selectMyOpenTasks', () => {
  it('只取我的、未完成、临近(≤7天)或逾期，按截止升序', () => {
    const tasks = [
      mk({ id: 'overdue', due_date: '2026-01-10' }), // -5 ✓
      mk({ id: 'soon', due_date: '2026-01-20' }), // +5 ✓
      mk({ id: 'far', due_date: '2026-02-15' }), // +31 ✗
      mk({ id: 'done', due_date: '2026-01-10', is_done: true }), // ✗
      mk({ id: 'other', due_date: '2026-01-16', assigned_to: 'someone' }), // ✗
      mk({ id: 'nodue', due_date: null }), // ✗（无截止不算临近/逾期）
    ]
    const r = selectMyOpenTasks(tasks, 'me', TODAY, 7)
    expect(r.map((t) => t.id)).toEqual(['overdue', 'soon'])
  })

  it('传入在册客户表时，归档/已删客户的待办被排除；无关联客户的个人待办保留', () => {
    const tasks = [
      mk({ id: 'active', due_date: '2026-01-16', customer_id: 'cu1' }),
      mk({ id: 'archived', due_date: '2026-01-16', customer_id: 'gone' }),
      mk({ id: 'personal', due_date: '2026-01-16', customer_id: null }),
    ]
    const r = selectMyOpenTasks(tasks, 'me', TODAY, 7, { cu1: {} })
    expect(r.map((t) => t.id).sort()).toEqual(['active', 'personal'])
  })
})

describe('selectCaseTasks', () => {
  it('只取本案件、未完成；按截止日升序、无截止排末；默认取前 3', () => {
    const tasks = [
      mk({ id: 'd20', case_id: 'c1', due_date: '2026-01-20' }),
      mk({ id: 'd10', case_id: 'c1', due_date: '2026-01-10' }),
      mk({ id: 'nodue', case_id: 'c1', due_date: null, created_at: '2026-01-01' }),
      mk({ id: 'd15', case_id: 'c1', due_date: '2026-01-15' }),
      mk({ id: 'done', case_id: 'c1', due_date: '2026-01-05', is_done: true }), // 已完成 ✗
      mk({ id: 'other', case_id: 'c2', due_date: '2026-01-12' }), // 别的案件 ✗
    ]
    const r = selectCaseTasks(tasks, 'c1')
    // d10 < d15 < d20，nodue 被截在第 4 位之外
    expect(r.map((t) => t.id)).toEqual(['d10', 'd15', 'd20'])
  })

  it('同截止日按创建时间倒序；无截止的待办排在有截止的之后', () => {
    const tasks = [
      mk({ id: 'nodue-old', case_id: 'c1', due_date: null, created_at: '2026-01-01' }),
      mk({ id: 'same-early', case_id: 'c1', due_date: '2026-01-10', created_at: '2026-01-02' }),
      mk({ id: 'same-late', case_id: 'c1', due_date: '2026-01-10', created_at: '2026-01-05' }),
      mk({ id: 'nodue-new', case_id: 'c1', due_date: null, created_at: '2026-01-09' }),
    ]
    const r = selectCaseTasks(tasks, 'c1', 10)
    expect(r.map((t) => t.id)).toEqual(['same-late', 'same-early', 'nodue-new', 'nodue-old'])
  })

  it('无关联待办 → 空数组', () => {
    expect(selectCaseTasks([mk({ case_id: 'c2' })], 'c1')).toEqual([])
  })
})
