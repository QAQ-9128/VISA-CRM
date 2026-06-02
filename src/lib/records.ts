import type { RecordRow } from '../types/models'
import { utcDayDiff } from './dateDiff'

/**
 * 记录的「相关日期」：待办用完成日(done_at，未完成则截止日 due_date)，跟进用创建日。
 * 都缺则回退 created_at。用于「记录」表按更新日期倒序。
 */
export function recordDate(r: RecordRow): string {
  if (r.type === 'task') {
    if (r.is_done && r.done_at) return r.done_at
    return r.due_date ?? r.created_at
  }
  return r.created_at
}

/** 日期-only(YYYY-MM-DD) 规整到当天起点，便于与时间戳统一比较。 */
function sortable(d: string): string {
  return d.length === 10 ? `${d}T00:00:00` : d
}

/** 按相关日期倒序排列记录（最新在上）；同日期按 created_at、id 稳定。 */
export function sortRecords(records: RecordRow[]): RecordRow[] {
  return [...records].sort(
    (a, b) =>
      sortable(recordDate(b)).localeCompare(sortable(recordDate(a))) ||
      b.created_at.localeCompare(a.created_at) ||
      a.id.localeCompare(b.id),
  )
}

/** 升序（最早在上），sortRecords 的反序。 */
export function sortRecordsAsc(records: RecordRow[]): RecordRow[] {
  return sortRecords(records).reverse()
}

// ── 记录视图：类型筛选 / 统计 / 待跟进（全部来自真实列，不引入不存在的分类）──
export type RecordTypeFilter = 'all' | 'task' | 'follow_up'

/** 按真实 type 过滤：全部 / 待办(task) / 跟进(follow_up)。 */
export function filterRecordsByType(records: RecordRow[], filter: RecordTypeFilter): RecordRow[] {
  if (filter === 'all') return records
  return records.filter((r) => r.type === filter)
}

export interface RecordStats {
  total: number
  /** 近 7 天内创建（含今天） */
  thisWeek: number
  /** 未完成待办数 */
  pending: number
}

/** 记录统计：总数 / 近 7 天新增 / 未完成待办。全部按真实列计数。 */
export function recordStats(records: RecordRow[], today: Date = new Date()): RecordStats {
  let thisWeek = 0
  let pending = 0
  for (const r of records) {
    const age = utcDayDiff(r.created_at.slice(0, 10), today)
    if (age >= 0 && age <= 6) thisWeek++
    if (r.type === 'task' && !r.is_done) pending++
  }
  return { total: records.length, thisWeek, pending }
}

/** 待跟进事项 = 未完成待办，按截止日升序（有截止日在前，再按创建倒序）。 */
export function selectPendingTasks(records: RecordRow[]): RecordRow[] {
  return records
    .filter((r) => r.type === 'task' && !r.is_done)
    .sort((a, b) => {
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
      if (a.due_date) return -1
      if (b.due_date) return 1
      return (b.created_at ?? '').localeCompare(a.created_at ?? '')
    })
}
