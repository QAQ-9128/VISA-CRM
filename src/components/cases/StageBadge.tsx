import { CASE_STAGE_LABELS } from '../../types/domain'
import { stageBadgeClass } from '../../lib/statusColor'
import type { CaseStage } from '../../types/domain'

/**
 * 阶段徽章：按 6 类状态类别上色（lib/statusColor 单一来源，同类同色——
 * 紫待办/蓝等待外部/灰进行中/黄需行动/绿完成/红终止；阶段流转记录/列表状态列同一套）。
 */
export function StageBadge({ stage }: { stage: CaseStage }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-[11px] py-1 text-xs font-semibold ${stageBadgeClass(stage)}`}
    >
      {CASE_STAGE_LABELS[stage] ?? stage}
    </span>
  )
}
