import { utcDayDiff } from './dateDiff'
import type { RecordRow } from '../types/models'

/** 截止日倒计时文案：未来「还剩 N 天」/ 当天「今天到期」/ 过期「逾期 N 天」；无截止日返回 null。 */
export function formatDueCountdown(dueDate: string | null, today: Date = new Date()): string | null {
  if (!dueDate) return null
  const diff = utcDayDiff(today, dueDate) // 今天→截止：正=未来天数，负=已过天数
  if (diff > 0) return `还剩 ${diff} 天`
  if (diff === 0) return '今天到期'
  return `逾期 ${-diff} 天`
}

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
export function selectCaseTasks(tasks: RecordRow[], caseId: string, limit = 3): RecordRow[] {
  return tasks
    .filter((t) => t.type === 'task' && t.case_id === caseId && !t.is_done)
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
 * 「我的待办」：未完成、且（分配给我 或 我创建的）全部待办——不再限「有截止日且临近」，
 * 也不再仅看 assigned_to（避免新建/迁移待办因 assigned_to 没对上而被筛掉），确保概览一眼可见。
 * 排序：有截止日的在前、按截止日升序（逾期/临近自然靠前）；无截止日的排后、按创建时间倒序。
 * 传入 activeCustomerById（未归档客户表）时，归档/已删客户名下的待办会被排除。
 */
export function selectMyOpenTasks(
  tasks: RecordRow[],
  userId: string | undefined,
  activeCustomerById?: Record<string, unknown>,
): RecordRow[] {
  if (!userId) return []
  return tasks
    .filter(
      (t) =>
        t.type === 'task' &&
        !t.is_done &&
        (t.assigned_to === userId || t.created_by === userId) &&
        (activeCustomerById == null || !t.customer_id || !!activeCustomerById[t.customer_id]),
    )
    .sort((a, b) => {
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
      if (a.due_date) return -1
      if (b.due_date) return 1
      return (b.created_at ?? '').localeCompare(a.created_at ?? '')
    })
}
