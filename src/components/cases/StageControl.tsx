import { useState } from 'react'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import { TextField } from '../ui/TextField'
import { StageBadge } from './StageBadge'
import { useUpdateCaseStage } from '../../hooks/queries/useCases'
import { CASE_STAGES, CASE_STAGE_LABELS } from '../../types/domain'
import type { CaseStage } from '../../types/domain'

/** 阶段流转：选择新阶段 + 可填备注 → 写入 case_stage_history。 */
export function StageControl({ caseId, currentStage }: { caseId: string; currentStage: CaseStage }) {
  const [stage, setStage] = useState<CaseStage>(currentStage)
  const [note, setNote] = useState('')
  const mutation = useUpdateCaseStage()

  const changed = stage !== currentStage
  const options = CASE_STAGES.map((s) => ({ value: s, label: CASE_STAGE_LABELS[s] }))

  function apply() {
    if (!changed) return
    mutation.mutate(
      { caseId, fromStage: currentStage, toStage: stage, note: note.trim() || null },
      { onSuccess: () => setNote('') },
    )
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">当前阶段</span>
        <StageBadge stage={currentStage} />
      </div>
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
      <Button onClick={apply} disabled={!changed || mutation.isPending}>
        {mutation.isPending ? '更新中…' : '更新阶段'}
      </Button>
      {mutation.isError && (
        <p className="text-sm text-rose-700">
          {mutation.error instanceof Error ? mutation.error.message : '更新失败'}
        </p>
      )}
    </div>
  )
}
