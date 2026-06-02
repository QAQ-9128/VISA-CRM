import { useState } from 'react'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import { TextField } from '../ui/TextField'
import { StageBadge } from './StageBadge'
import { useUpdateCaseStage } from '../../hooks/queries/useCases'
import { replaceDateKeepTime } from '../../lib/stageHistory'
import { CASE_STAGES, CASE_STAGE_LABELS } from '../../types/domain'
import type { CaseStage } from '../../types/domain'

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 阶段流转：选择新阶段 + 可填备注 → 写入 case_stage_history。
 *  disabled=true（进度同步态）时整块禁用 + 灰显，只读展示当前阶段 + 提示。 */
export function StageControl({
  caseId,
  currentStage,
  disabled = false,
  disabledHint,
}: {
  caseId: string
  currentStage: CaseStage
  disabled?: boolean
  disabledHint?: string
}) {
  const [stage, setStage] = useState<CaseStage>(currentStage)
  const [note, setNote] = useState('')
  const [effDate, setEffDate] = useState(todayStr)
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

      {disabled && (
        <p className="rounded-[12px] bg-surface-2 px-3 py-2 text-xs text-muted">
          {disabledHint ?? '本案件进度同步自主案件，stage 自动跟随，无法在此独立编辑。'}
        </p>
      )}

      {/* 禁用态：用 fieldset disabled 原生级联禁用内部所有控件 + 灰显 */}
      <fieldset disabled={disabled} className={disabled ? 'space-y-3 opacity-50' : 'space-y-3'}>
        <Select
          label="切换到"
          options={options}
          value={stage}
          onChange={(e) => setStage(e.target.value as CaseStage)}
        />
        {changed && (
          <TextField
            label="备注（可选，记入时间线）"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="如 已补充 PTE 成绩"
          />
        )}
        <TextField
          label="实际发生日期（默认今天，可补录过去）"
          type="date"
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
