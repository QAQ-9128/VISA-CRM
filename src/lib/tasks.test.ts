import { describe, expect, it } from 'vitest'
import { formatDueCountdown, isTaskOverdue, selectCaseTasks, selectMyOpenTasks } from './tasks'
import type { RecordRow } from '../types/models'

const TODAY = new Date(2026, 0, 15)

const mk = (o: Partial<RecordRow>): RecordRow => ({
  id: 't',
  customer_id: null as unknown as string,
  case_id: null,
  type: 'task',
  content: '待办',
  due_date: null,
  is_done: false,
  done_at: null,
  assigned_to: 'me',
  channel: null,
  emoji_marker: null,
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

describe('formatDueCountdown', () => {
  it('未来→还剩 N 天 / 当天→今天到期 / 过期→逾期 N 天 / 无→null', () => {
    expect(formatDueCountdown('2026-01-20', TODAY)).toBe('还剩 5 天')
    expect(formatDueCountdown('2026-01-15', TODAY)).toBe('今天到期')
    expect(formatDueCountdown('2026-01-10', TODAY)).toBe('逾期 5 天')
    expect(formatDueCountdown(null, TODAY)).toBeNull()
  })
})

describe('selectMyOpenTasks', () => {
  it('我名下全部未完成待办：有截止日按升序在前，无截止排后；已完成/他人的排除', () => {
    const tasks = [
      mk({ id: 'overdue', due_date: '2026-01-10' }),
      mk({ id: 'soon', due_date: '2026-01-20' }),
      mk({ id: 'far', due_date: '2026-02-15' }), // 不再因「太远」被剔除
      mk({ id: 'nodue', due_date: null, created_at: '2026-01-03' }), // 无截止也要显示（排后）
      mk({ id: 'done', due_date: '2026-01-10', is_done: true }), // ✗ 已完成
      mk({ id: 'other', due_date: '2026-01-16', assigned_to: 'someone' }), // ✗ 他人
    ]
    expect(selectMyOpenTasks(tasks, 'me').map((t) => t.id)).toEqual(['overdue', 'soon', 'far', 'nodue'])
  })

  it('传入在册客户表时，归档/已删客户的待办被排除', () => {
    const tasks = [
      mk({ id: 'active', due_date: '2026-01-16', customer_id: 'cu1' }),
      mk({ id: 'archived', due_date: '2026-01-16', customer_id: 'gone' }),
    ]
    expect(selectMyOpenTasks(tasks, 'me', { cu1: {} }).map((t) => t.id)).toEqual(['active'])
  })

  it('非 task 类型(跟进)不计入我的待办', () => {
    const tasks = [
      mk({ id: 'task', due_date: '2026-01-16', customer_id: 'cu1' }),
      mk({ id: 'follow', due_date: '2026-01-16', customer_id: 'cu1', type: 'follow_up' }),
    ]
    expect(selectMyOpenTasks(tasks, 'me').map((t) => t.id)).toEqual(['task'])
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
