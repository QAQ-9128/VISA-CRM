import type { Case } from '../types/models'
import type { CaseStage } from '../types/domain'

/**
 * 案件与「主案件」的三态关系（纯逻辑）。存储为两列：
 *   parent_case_id           —— 关联的主案件（null = 不关联）
 *   parent_sync_progress     —— 进度是否跟随主案件自动同步
 * 与既有的 sync_tracking（同申请合并账单）互不影响、并存。
 *
 *   independent  独立案件：无关联
 *   linked       关联主案件、进度独立（软关联，仅展示，如 482 Subsequent Entrant）
 *   synced       关联主案件、进度同步（stage 跟随主案件自动变，由 DB 触发器原子完成）
 */
export type CaseRelationship = 'independent' | 'linked' | 'synced'

/** 同步开启时写入 case_stage_history 的理由（与触发器同步理由区分）。 */
export const SYNC_ENABLE_NOTE = '进度同步开启'
/** 触发器把主案件 stage 同步到子案件时写入 history 的理由。 */
export const SYNC_FOLLOW_NOTE = '进度同步自主案件'

export function relationshipOf(c: Pick<Case, 'parent_case_id' | 'parent_sync_progress'>): CaseRelationship {
  if (!c.parent_case_id) return 'independent'
  return c.parent_sync_progress ? 'synced' : 'linked'
}

/**
 * 三态 + 选定主案件 → 写库的两列值。
 * 没选主案件时（parentCaseId 为空）任何关联态都退化为独立，杜绝「sync=true 却无 parent」的非法态。
 */
export function relationshipPatch(
  rel: CaseRelationship,
  parentCaseId: string | null,
): { parent_case_id: string | null; parent_sync_progress: boolean } {
  if (rel === 'independent' || !parentCaseId) {
    return { parent_case_id: null, parent_sync_progress: false }
  }
  return { parent_case_id: parentCaseId, parent_sync_progress: rel === 'synced' }
}

/**
 * 开启「进度同步」时的一次性对齐：把本案 stage 立即设为主案件当前 stage，并写一条 history。
 * 后续主案件 stage 变化的持续同步由 DB 触发器负责（这里只管「开启那一刻」的对齐）。
 * 返回 null = 无需动作（非同步态，或 stage 已一致）。
 */
export function syncStageAction(
  rel: CaseRelationship,
  caseStage: CaseStage,
  parentStage: CaseStage,
): { toStage: CaseStage; note: string } | null {
  if (rel !== 'synced') return null
  if (caseStage === parentStage) return null
  return { toStage: parentStage, note: SYNC_ENABLE_NOTE }
}

/**
 * 给 childId 选 candidateParentId 作主案件是否会成环（沿 candidate 的 parent 链上溯遇到 child）。
 * 用于在前端排除会成环的候选；DB 触发器另有递归深度限制作为安全网。
 */
export function wouldCreateCycle(cases: Case[], childId: string, candidateParentId: string): boolean {
  if (childId === candidateParentId) return true
  const byId = new Map(cases.map((c) => [c.id, c]))
  let cur = byId.get(candidateParentId)
  let depth = 0
  while (cur && depth < 50) {
    if (cur.id === childId) return true
    if (!cur.parent_case_id) break
    cur = byId.get(cur.parent_case_id)
    depth++
  }
  return false
}

export interface StageSyncEntry {
  caseId: string
  fromStage: CaseStage
  toStage: CaseStage
}

/**
 * 主案件 stage 改为 newStage 时，应跟随变化的子案件（参考实现，与 DB 触发器逻辑一致，供单测/文档用）：
 * 仅「parent_case_id = 主案件 且 parent_sync_progress = true 且当前 stage 不同」的子案件跟变。
 * 独立子案件（sync=false）、无关案件、已同 stage 的子案件都不动。
 */
export function propagateSyncedStage(cases: Case[], parentId: string, newStage: CaseStage): StageSyncEntry[] {
  return cases
    .filter(
      (c) => c.parent_case_id === parentId && c.parent_sync_progress && c.current_stage !== newStage,
    )
    .map((c) => ({ caseId: c.id, fromStage: c.current_stage, toStage: newStage }))
}
