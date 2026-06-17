import { useState } from 'react'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import { TextField } from '../ui/TextField'
import { StageBadge } from './StageBadge'
import { useUpdateCaseStage } from '../../hooks/queries/useCases'
import { replaceDateKeepTime } from '../../lib/stageHistory'
import { todayYmd, isFutureYmd } from '../../lib/dateRules'
import { toastError } from '../../store/ui'
import { CASE_STAGES, CASE_STAGE_LABELS } from '../../types/domain'
import type { CaseStage } from '../../types/domain'

/** 阶段流转：选择新阶段 + 可填备注 → 写入 case_stage_history。
 *  一案一组：一份进度全员共享，无任何锁定/同步态——随时可编辑。 */
export function StageControl({
  caseId,
  currentStage,
}: {
  caseId: string
  currentStage: CaseStage
}) {
  const [stage, setStage] = useState<CaseStage>(currentStage)
  const [note, setNote] = useState('')
  const [effDate, setEffDate] = useState(todayYmd)
  const mutation = useUpdateCaseStage()

  const changed = stage !== currentStage
  // 下拉列出全部正式阶段（CASE_STAGES，共 11 个）；若当前案件停在旧「补件」(additional_docs)
  // 等已废弃值，把它补到最前面以便正常显示/可切走（新案件不会看到它）。
  const isListed = (CASE_STAGES as readonly string[]).includes(currentStage)
  const options = [
    ...(isListed ? [] : [{ value: currentStage, label: CASE_STAGE_LABELS[currentStage] }]),
    ...CASE_STAGES.map((s) => ({ value: s, label: CASE_STAGE_LABELS[s] })),
  ]

  function apply() {
    if (!changed) return
    // 阶段记录的是已发生的事 → 禁未来日期（max 属性 + 此处兜底拦手输）
    if (isFutureYmd(effDate)) {
      toastError('实际发生日期不能是未来——阶段记录的是已发生的事')
      return
    }
    // 实际发生时间：用所填日期 + 当前时分秒（默认今天=现在）
    const effectiveAt = effDate ? replaceDateKeepTime(new Date().toISOString(), effDate) : null
    mutation.mutate(
      { caseId, fromStage: currentStage, toStage: stage, note: note.trim() || null, effectiveAt },
      { onSuccess: () => setNote('') },
    )
  }

  return (
    <div className="space-y-3 rounded-card bg-white p-[22px] shadow-soft">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted">当前阶段</span>
        <StageBadge stage={currentStage} />
      </div>

      <fieldset className="space-y-3">
        <Select
          label="切换到"
          options={options}
          value={stage}
          onChange={(e) => setStage(e.target.value as CaseStage)}
        />
        {/* 备注常驻：推进到任意阶段都可填备注（可选，记入时间线）。不放示例占位文案，留空即可。 */}
        <TextField
          label="备注（可选，记入时间线）"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <TextField
          label="实际发生日期（默认今天，可补录过去，不能选未来）"
          type="date"
          max={todayYmd()}
          value={effDate}
          onChange={(e) => setEffDate(e.target.value)}
        />
        <Button onClick={apply} disabled={!changed || mutation.isPending}>
          {mutation.isPending ? '更新中…' : '更新阶段'}
        </Button>
      </fieldset>

      {mutation.isError && (
        <p className="text-sm text-rose-700">
          {mutation.error instanceof Error ? mutation.error.message : '更新失败'}
        </p>
      )}
    </div>
  )
}
