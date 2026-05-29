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
 * 某案件的「最新待办」：取该案件未完成待办，按截止日升序（无截止排末），
 * 同截止日按创建时间倒序，默认取前 limit 条。用于全部案件列表每行的待办预览。
 */
export function selectCaseTasks(tasks: Task[], caseId: string, limit = 3): Task[] {
  return tasks
    .filter((t) => t.case_id === caseId && !t.is_done)
    .sort((a, b) => {
      // 有截止日的在前；都有则按截止日升序
      if (a.due_date && b.due_date) {
        if (a.due_date !== b.due_date) return a.due_date.localeCompare(b.due_date)
      } else if (a.due_date) return -1
      else if (b.due_date) return 1
      // 截止日相同或都无 → 创建时间倒序（新在前）
      return (b.created_at ?? '').localeCompare(a.created_at ?? '')
    })
    .slice(0, limit)
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
