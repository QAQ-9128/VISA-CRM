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
 * 递交进度表「待办」列：某案件下未完成的全部记录（待办 + 跟进，不限类型——跟进带表情符号也要出现），
 * 按 updated_at 倒序（最近更新在前），取前 limit 条。
 * 与 selectCaseTasks 区别：这里按更新时间排序（表格列预览用）且含跟进，后者按截止日且仅待办。
 */
export function selectCaseTodoPreviews(tasks: RecordRow[], caseId: string, limit = 3): RecordRow[] {
  return tasks
    .filter((t) => t.case_id === caseId && !t.is_done)
    .sort(
      (a, b) =>
        (b.updated_at ?? '').localeCompare(a.updated_at ?? '') ||
        (b.created_at ?? '').localeCompare(a.created_at ?? ''),
    )
    .slice(0, limit)
}

