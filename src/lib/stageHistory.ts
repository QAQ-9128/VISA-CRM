import type { CaseStage } from '../types/domain'
import type { CaseStageHistory } from '../types/models'

/**
 * 把 ISO 时间戳的「日期」换成 dateStr(YYYY-MM-DD)，保留原时分秒（及时区后缀）。
 * 用于阶段历史「改实际发生日期」：只改日、时分秒沿用默认，避免时区/解析误差。
 */
export function replaceDateKeepTime(iso: string, dateStr: string): string {
  const tIdx = iso.indexOf('T')
  const timePart = tIdx >= 0 ? iso.slice(tIdx + 1) : '00:00:00'
  return `${dateStr}T${timePart}`
}

/**
 * 阶段流转按「实际发生时间」降序的比较器（与 getCaseStageHistory 的 DB 排序同口径）；
 * effective_at 相同再按写入时间 changed_at 兜底，保证「最新一条」唯一确定（字符串 ISO 可直接比较）。
 */
function compareDesc(a: CaseStageHistory, b: CaseStageHistory): number {
  if (a.effective_at !== b.effective_at) return a.effective_at < b.effective_at ? 1 : -1
  if (a.changed_at !== b.changed_at) return a.changed_at < b.changed_at ? 1 : -1
  return 0
}

/** 最新一条阶段流转（实际发生时间最晚）；空记录 → null。乱序输入也正确。 */
export function latestStageHistory(history: CaseStageHistory[]): CaseStageHistory | null {
  if (history.length === 0) return null
  return [...history].sort(compareDesc)[0]
}

/**
 * 「当前阶段」的单一来源派生：当前阶段 = 最新一条流转记录的目标阶段 to_stage。
 * 这样新增/删除流转后当前阶段自动重算、绝不与另存的 current_stage 脱钩。
 * 无任何流转记录时返回 null（由调用方决定初始兜底）。
 */
export function deriveCurrentStage(history: CaseStageHistory[]): CaseStage | null {
  return latestStageHistory(history)?.to_stage ?? null
}

/**
 * 删除某条流转后应回退到的当前阶段：
 *  - 仍有剩余记录 → 剩余里最新一条的 to_stage（删最新一条即回到「上一个」）；
 *  - 删到空 → 回到被删那条的来源阶段 from_stage（案件初始）；from_stage 为空兜底 'todo'。
 */
export function recomputeStageAfterDelete(
  remaining: CaseStageHistory[],
  deleted: CaseStageHistory,
): CaseStage {
  return deriveCurrentStage(remaining) ?? deleted.from_stage ?? 'todo'
}

/** 是否为「最新一条」流转——只允许删最新一条（= 回退一步），避免删中间记录把链断开。 */
export function isLatestStageHistory(history: CaseStageHistory[], id: string): boolean {
  return latestStageHistory(history)?.id === id
}
