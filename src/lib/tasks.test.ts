import { describe, expect, it } from 'vitest'
import { isTaskOverdue, selectMyOpenTasks } from './tasks'
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
})
