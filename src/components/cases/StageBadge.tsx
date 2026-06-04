import { CASE_STAGE_LABELS, CASE_STAGE_STYLES } from '../../types/domain'
import type { CaseStage } from '../../types/domain'

/**
 * 阶段徽章：逐阶段专属配色（CASE_STAGE_STYLES 为唯一来源，11 个正式阶段互不重色——
 * 阶段进展链 / 阶段流转记录 / 列表状态列同一套色，扫一眼颜色即知阶段）。
 */
export function StageBadge({ stage }: { stage: CaseStage }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-[11px] py-1 text-xs font-semibold ${
        CASE_STAGE_STYLES[stage] ?? 'bg-slate-100 text-slate-700'
      }`}
    >
      {CASE_STAGE_LABELS[stage] ?? stage}
    </span>
  )
}
