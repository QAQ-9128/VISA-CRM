import type { RecordRow } from '../types/models'

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
