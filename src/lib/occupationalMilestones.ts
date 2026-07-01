import { localYmd } from './dateRules'
import type { CaseStageHistory } from '../types/models'

/**
 * 职业评估顶部两张里程碑卡（技术评估递交 / 评估结果）的纯派生（§7）。
 * 从阶段流转记录派生（不存额外字段）：
 *   - 技术评估递交 = 最近一次 to_stage='oa_skill_submitted' 的实际发生日期（本地日，禁 UTC）；
 *   - 评估结果     = 最近一次 to_stage∈{oa_positive,oa_negative}（正/负结果 + 日期）。
 * 无对应记录则为 null（UI 显「—」）。日期口径与 StageTimeline 一致（localYmd(effective_at)）。
 */

export type OccupationalOutcomeStage = 'oa_positive' | 'oa_negative'

export interface OccupationalMilestones {
  skillSubmittedDate: string | null
  outcome: { stage: OccupationalOutcomeStage; date: string } | null
}

function recentByEffective(history: CaseStageHistory[]): CaseStageHistory[] {
  return [...history].sort((a, b) => (b.effective_at ?? '').localeCompare(a.effective_at ?? ''))
}

export function selectOccupationalMilestones(history: CaseStageHistory[]): OccupationalMilestones {
  const recent = recentByEffective(history)
  const skill = recent.find((h) => h.to_stage === 'oa_skill_submitted')
  const out = recent.find((h) => h.to_stage === 'oa_positive' || h.to_stage === 'oa_negative')
  return {
    skillSubmittedDate: skill?.effective_at ? localYmd(new Date(skill.effective_at)) : null,
    outcome:
      out?.effective_at
        ? { stage: out.to_stage as OccupationalOutcomeStage, date: localYmd(new Date(out.effective_at)) }
        : null,
  }
}
