import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'
import { Badge } from '../ui/Badge'
import { LodgementProgressBar } from './LodgementProgressBar'
import { useCreateLodgement, useLodgements, useUpdateLodgement } from '../../hooks/queries/useLodgements'
import {
  LODGEMENT_OUTCOMES,
  LODGEMENT_OUTCOME_LABELS,
  LODGEMENT_TYPE_LABELS,
} from '../../types/domain'
import type { LodgementOutcome, LodgementType } from '../../types/domain'
import type { Lodgement } from '../../types/models'

/** DHA 官方签证处理时间页 */
const DHA_PROCESSING_TIMES_URL =
  'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-processing-times'

const OUTCOME_STYLE: Record<LodgementOutcome, string> = {
  pending: 'bg-slate-100 text-slate-600',
  approved: 'bg-emerald-100 text-emerald-800',
  refused: 'bg-rose-100 text-rose-800',
  withdrawn: 'bg-gray-200 text-gray-600',
}

const numOrNull = (s: string) => (s.trim() === '' ? null : Number(s))
const strOrNull = (s: string) => (s.trim() === '' ? null : s.trim())

function LodgementForm({
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

  const [lodgedDate, setLodgedDate] = useState(initial?.lodged_date ?? '')
  const [ref, setRef] = useState(initial?.reference_number ?? '')
  const [days, setDays] = useState(initial?.dha_processing_days?.toString() ?? '')
  const [daysUpdated, setDaysUpdated] = useState(initial?.dha_processing_updated_at ?? '')
  const [outcome, setOutcome] = useState<LodgementOutcome>(initial?.outcome ?? 'pending')
  const [outcomeDate, setOutcomeDate] = useState(initial?.outcome_date ?? '')
  const [note, setNote] = useState(initial?.note ?? '')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const fields = {
      lodged_date: strOrNull(lodgedDate),
      reference_number: strOrNull(ref),
      dha_processing_days: numOrNull(days),
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
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-indigo-200 bg-indigo-50/40 p-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <TextField label="递交日期" type="date" value={lodgedDate} onChange={(e) => setLodgedDate(e.target.value)} />
        <TextField label="移民局参考号" value={ref} onChange={(e) => setRef(e.target.value)} />
        <TextField
          label="DHA 处理时间（天）"
          type="number"
          min={1}
          value={days}
          onChange={(e) => setDays(e.target.value)}
        />
        <TextField
          label="处理时间更新于"
          type="date"
          value={daysUpdated}
          onChange={(e) => setDaysUpdated(e.target.value)}
        />
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

function LodgementSlot({
  caseId,
  type,
  lodgement,
}: {
  caseId: string
  type: LodgementType
  lodgement?: Lodgement
}) {
  const [editing, setEditing] = useState(false)
  const typeLabel = LODGEMENT_TYPE_LABELS[type]

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-medium text-slate-900">{typeLabel}递交</h3>
        {lodgement && !editing && (
          <Badge className={OUTCOME_STYLE[lodgement.outcome]}>
            {LODGEMENT_OUTCOME_LABELS[lodgement.outcome]}
          </Badge>
        )}
      </div>

      {editing ? (
        <LodgementForm caseId={caseId} type={type} initial={lodgement} onDone={() => setEditing(false)} />
      ) : lodgement ? (
        <div className="space-y-3">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-slate-500">递交日期</dt>
            <dd className="text-right text-slate-900">{lodgement.lodged_date || '未递交'}</dd>
            <dt className="text-slate-500">参考号</dt>
            <dd className="text-right text-slate-900">{lodgement.reference_number || '—'}</dd>
            {lodgement.outcome !== 'pending' && (
              <>
                <dt className="text-slate-500">结果日期</dt>
                <dd className="text-right text-slate-900">{lodgement.outcome_date || '—'}</dd>
              </>
            )}
          </dl>
          {lodgement.outcome === 'pending' && (
            <LodgementProgressBar
              lodgedDate={lodgement.lodged_date}
              dhaProcessingDays={lodgement.dha_processing_days}
            />
          )}
          {lodgement.note && <p className="text-sm text-slate-600">{lodgement.note}</p>}
          <Button variant="secondary" onClick={() => setEditing(true)}>
            编辑
          </Button>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setEditing(true)}>
          + 添加{typeLabel}递交
        </Button>
      )}
    </div>
  )
}

/** 案件的递交区：nomination / visa 两槽 + DHA 处理时间官网入口。 */
export function LodgementSection({ caseId }: { caseId: string }) {
  const lodgements = useLodgements(caseId)
  const byType = (t: LodgementType) => lodgements.data?.find((l) => l.type === t)

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">递交记录</h2>
        <a
          href={DHA_PROCESSING_TIMES_URL}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium text-indigo-600 hover:underline"
        >
          DHA 处理时间 ↗
        </a>
      </div>

      {lodgements.isPending ? (
        <p className="text-sm text-slate-400">加载递交记录…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <LodgementSlot caseId={caseId} type="nomination" lodgement={byType('nomination')} />
          <LodgementSlot caseId={caseId} type="visa" lodgement={byType('visa')} />
        </div>
      )}
    </section>
  )
}
