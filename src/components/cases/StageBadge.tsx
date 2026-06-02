import { Pill } from '../ui/Pill'
import type { PillTone } from '../ui/Pill'
import { CASE_STAGE_LABELS } from '../../types/domain'
import type { CaseStage } from '../../types/domain'

/** 阶段 → Pill 色调（对齐 domain 语义色；见 full-site README）。 */
const STAGE_TONE: Record<CaseStage, PillTone> = {
  todo: 'slate',
  drafted: 'amber',
  nomination_lodged: 'blue',
  nomination_approved: 'cyan',
  visa_lodged: 'indigo',
  docs_requested: 'amber',
  docs_completed: 'teal',
  granted: 'emerald',
  refused: 'rose',
  appeal: 'violet',
  withdrawn: 'slate',
  additional_docs: 'amber', // 旧数据兼容
}

export function StageBadge({ stage }: { stage: CaseStage }) {
  return (
    <Pill tone={STAGE_TONE[stage] ?? 'slate'} dot={false}>
      {CASE_STAGE_LABELS[stage]}
    </Pill>
  )
}
