import { CASE_STAGES } from '../types/domain'
import type { CaseStage } from '../types/domain'
import type { Case } from '../types/models'

export interface StageColumn {
  stage: CaseStage
  cases: Case[]
}

/** 按 CASE_STAGES 顺序把案件分到各阶段列（含空列，供看板渲染）。 */
export function groupCasesByStage(cases: Case[]): StageColumn[] {
  const columns: StageColumn[] = CASE_STAGES.map((stage) => ({ stage, cases: [] }))
  const byStage = new Map(columns.map((col) => [col.stage, col]))
  for (const c of cases) {
    byStage.get(c.current_stage)?.cases.push(c)
  }
  return columns
}
