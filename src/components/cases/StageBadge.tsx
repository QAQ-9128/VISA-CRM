import { Badge } from '../ui/Badge'
import { CASE_STAGE_LABELS, CASE_STAGE_STYLES } from '../../types/domain'
import type { CaseStage } from '../../types/domain'

export function StageBadge({ stage }: { stage: CaseStage }) {
  return <Badge className={CASE_STAGE_STYLES[stage]}>{CASE_STAGE_LABELS[stage]}</Badge>
}
