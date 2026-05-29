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

/** 阶段流转：选择新阶段 + 可填备注 → 写入 case_stage_history。 */
export function StageControl({ caseId, currentStage }: { caseId: string; currentStage: CaseStage }) {
  const [stage, setStage] = useState<CaseStage>(currentStage)
  const [note, setNote] = useState('')
  const [effDate, setEffDate] = useState(todayStr)
  const mutation = useUpdateCaseStage()

  const changed = stage !== currentStage
  const options = CASE_STAGES.map((s) => ({ value: s, label: CASE_STAGE_LABELS[s] }))

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
      <TextField
        label="实际发生日期（默认今天，可补录过去）"
        type="date"
        value={effDate}
        onChange={(e) => setEffDate(e.target.value)}
      />
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
