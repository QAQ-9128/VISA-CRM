import { utcDayDiff } from './dateDiff'
import type { Task } from '../types/models'

/** 待办是否逾期（未完成且截止日 < 今天，UTC 天数，DST 安全）。 */
export function isTaskOverdue(
  dueDate: string | null,
  isDone: boolean,
  today: Date = new Date(),
): boolean {
  if (isDone || !dueDate) return false
  return utcDayDiff(today, dueDate) < 0
}

/**
 * 「我的待办」：分配给我、未完成、且有截止日并临近(≤soonDays)或已逾期；按截止日升序。
 * 传入 activeCustomerById（未归档客户表）时，归档/已删客户名下的待办会被排除；
 * 无关联客户(customer_id 为空)的个人待办始终保留。
 */
export function selectMyOpenTasks(
  tasks: Task[],
  userId: string | undefined,
  today: Date = new Date(),
  soonDays = 7,
  activeCustomerById?: Record<string, unknown>,
): Task[] {
  if (!userId) return []
  return tasks
    .filter(
      (t) =>
        !t.is_done &&
        t.assigned_to === userId &&
        t.due_date != null &&
        utcDayDiff(today, t.due_date) <= soonDays &&
        (activeCustomerById == null || !t.customer_id || !!activeCustomerById[t.customer_id]),
    )
    .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
}
