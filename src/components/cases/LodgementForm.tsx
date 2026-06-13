import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'
import { useCreateLodgement, useUpdateLodgement } from '../../hooks/queries/useLodgements'
import { LODGEMENT_OUTCOMES, LODGEMENT_OUTCOME_LABELS } from '../../types/domain'
import type { LodgementOutcome, LodgementType } from '../../types/domain'
import type { Lodgement } from '../../types/models'
import { todayYmd } from '../../lib/dateRules'

const strOrNull = (s: string) => (s.trim() === '' ? null : s.trim())
// DHA 处理天数：正整数；非数字/小于 1 视为未填（避免 NaN/小数写入整型列）
const daysOrNull = (s: string) => {
  const n = Number(s)
  return s.trim() === '' || !Number.isFinite(n) || n < 1 ? null : Math.round(n)
}

/**
 * 提名/签证 lodgement 新增·编辑表单。递交日期不在此录入（由阶段更新的实际发生日期 + stage_history 派生）。
 * 只写真实字段：参考号 / DHA 处理天数 / 处理时间更新于 / 结果 / 结果日期 / 备注。
 */
export function LodgementForm({
  caseId,
  type,
  initial,
  onDone,
}: {
  caseId: string
  type: LodgementType
  initial?: Lodgement
  onDone: () => void
}) {
  const create = useCreateLodgement(caseId)
  const update = useUpdateLodgement(caseId)
  const saving = create.isPending || update.isPending

  const [ref, setRef] = useState(initial?.reference_number ?? '')
  const [days, setDays] = useState(initial?.dha_processing_days?.toString() ?? '')
  const [daysUpdated, setDaysUpdated] = useState(initial?.dha_processing_updated_at ?? '')
  const [outcome, setOutcome] = useState<LodgementOutcome>(initial?.outcome ?? 'pending')
  const [outcomeDate, setOutcomeDate] = useState(initial?.outcome_date ?? '')
  const [note, setNote] = useState(initial?.note ?? '')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const fields = {
      reference_number: strOrNull(ref),
      dha_processing_days: daysOrNull(days),
      dha_processing_updated_at: strOrNull(daysUpdated),
      outcome,
      outcome_date: outcome === 'pending' ? null : strOrNull(outcomeDate),
      note: strOrNull(note),
    }
    if (initial) {
      update.mutate({ id: initial.id, patch: fields }, { onSuccess: onDone })
    } else {
      create.mutate({ case_id: caseId, type, ...fields }, { onSuccess: onDone })
    }
  }

  const outcomeOptions = LODGEMENT_OUTCOMES.map((o) => ({ value: o, label: LODGEMENT_OUTCOME_LABELS[o] }))

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-brand-100 bg-brand-50/40 p-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <TextField label="移民局参考号" value={ref} onChange={(e) => setRef(e.target.value)} />
        <TextField label="DHA 处理时间（天）" type="number" min={1} step={1} value={days} onChange={(e) => setDays(e.target.value)} />
        <TextField label="处理时间更新于" type="date" max={todayYmd()} value={daysUpdated} onChange={(e) => setDaysUpdated(e.target.value)} />
        <Select label="结果" options={outcomeOptions} value={outcome} onChange={(e) => setOutcome(e.target.value as LodgementOutcome)} />
        {outcome !== 'pending' && (
          <TextField label="结果日期" type="date" value={outcomeDate} onChange={(e) => setOutcomeDate(e.target.value)} />
        )}
      </div>
      <Textarea label="备注" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? '保存中…' : '保存'}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          取消
        </Button>
      </div>
    </form>
  )
}
