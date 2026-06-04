import type { CaseStageHistory } from '../types/models'
import type { CaseStage } from '../types/domain'

/**
 * 「阶段进展」真实流转链（纯派生）：只画 case_stage_history 里实际走过的节点，
 * **绝不线性自动填充**——若实际从待办直接跳提名获批，链上就只有这两个节点。
 * 节点日期 = 该次流转的实际发生日（effective_at 优先，回退 changed_at）；起点节点无日期。
 */
export interface StagePathNode {
  stage: CaseStage
  /** yyyy-mm-dd；起点（首行 from_stage）为 null */
  date: string | null
}

const sortKey = (r: CaseStageHistory) => r.effective_at ?? r.changed_at ?? ''
const dateOf = (r: CaseStageHistory) => (r.effective_at ?? r.changed_at)?.slice(0, 10) ?? null

export function selectStagePath(history: CaseStageHistory[], currentStage: CaseStage): StagePathNode[] {
  if (history.length === 0) return [{ stage: currentStage, date: null }]
  const rows = [...history].sort((a, b) => sortKey(a).localeCompare(sortKey(b)) || a.id.localeCompare(b.id))
  const nodes: StagePathNode[] = []
  const first = rows[0]
  if (first.from_stage) nodes.push({ stage: first.from_stage, date: null })
  for (const r of rows) nodes.push({ stage: r.to_stage, date: dateOf(r) })
  return nodes
}
