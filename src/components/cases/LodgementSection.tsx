import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'
import { Badge } from '../ui/Badge'
import { LodgementProgressBar } from './LodgementProgressBar'
import { useCreateLodgement, useLodgements, useUpdateLodgement } from '../../hooks/queries/useLodgements'
import { useCaseStageHistory } from '../../hooks/queries/useCases'
import { calculateWaitDays } from '../../lib/casesTable'
import {
  getLodgementLodgedDate,
  getLodgementStatus,
  LODGEMENT_STATUS_LABELS,
  LODGEMENT_STATUS_STYLES,
} from '../../lib/lodgementStatus'
import {
  LODGEMENT_OUTCOMES,
  LODGEMENT_OUTCOME_LABELS,
  LODGEMENT_TYPE_LABELS,
} from '../../types/domain'
import type { CaseStage, LodgementOutcome, LodgementType } from '../../types/domain'
import type { CaseStageHistory, Lodgement } from '../../types/models'

/** DHA 官方签证处理时间页 */
const DHA_PROCESSING_TIMES_URL =
  'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-processing-times'

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

  const [ref, setRef] = useState(initial?.reference_number ?? '')
  const [days, setDays] = useState(initial?.dha_processing_days?.toString() ?? '')
  const [daysUpdated, setDaysUpdated] = useState(initial?.dha_processing_updated_at ?? '')
  const [outcome, setOutcome] = useState<LodgementOutcome>(initial?.outcome ?? 'pending')
  const [outcomeDate, setOutcomeDate] = useState(initial?.outcome_date ?? '')
  const [note, setNote] = useState(initial?.note ?? '')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    // 递交日期不再在此录入：改由阶段更新表单的「实际发生日期」+ 时间线上的 stage_history 派生。
    const fields = {
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

/** 等待天数行：已决冻结→灰；未决且超 DHA 处理天数→红；其余默认。lodgedDate 为派生递交日期。 */
function WaitDaysValue({
  lodgedDate,
  caseId,
  dhaDays,
  stageHistory,
}: {
  lodgedDate: string | null
  caseId: string
  dhaDays: number | null
  stageHistory: CaseStageHistory[]
}) {
  const wait = calculateWaitDays(lodgedDate, caseId, stageHistory)
  if (!wait.lodged) return <dd className="text-right text-slate-900">—</dd>
  const overdue = !wait.frozen && dhaDays != null && wait.totalDays > dhaDays
  const cls = wait.frozen ? 'text-slate-400' : overdue ? 'text-rose-600' : 'text-slate-900'
  return (
    <dd className={`text-right ${cls}`} title={overdue ? '已超过 DHA 平均处理天数' : wait.frozen ? '案件已决，已冻结' : undefined}>
      {wait.label}
      {wait.frozen && <span className="text-slate-400">（已结案）</span>}
    </dd>
  )
}

function LodgementSlot({
  caseId,
  type,
  lodgement,
  currentStage,
  stageHistory,
}: {
  caseId: string
  type: LodgementType
  lodgement?: Lodgement
  currentStage: CaseStage
  stageHistory: CaseStageHistory[]
}) {
  const [editing, setEditing] = useState(false)
  const typeLabel = LODGEMENT_TYPE_LABELS[type]
  // 状态 + 递交日期都从案件阶段历史实时派生（不依赖 lodgement.outcome / lodged_date 存储值）
  const status = getLodgementStatus(currentStage, type, stageHistory)
  const lodgedDate = getLodgementLodgedDate(stageHistory, type)

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-medium text-slate-900">{typeLabel}递交</h3>
        {lodgement && !editing && (
          <Badge className={LODGEMENT_STATUS_STYLES[status]}>{LODGEMENT_STATUS_LABELS[status]}</Badge>
        )}
      </div>

      {editing ? (
        <LodgementForm caseId={caseId} type={type} initial={lodgement} onDone={() => setEditing(false)} />
      ) : lodgement ? (
        <div className="space-y-3">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-slate-500">递交日期</dt>
            <dd className="text-right text-slate-900">{lodgedDate || '—'}</dd>
            <dt className="text-slate-500">等待天数</dt>
            <WaitDaysValue
              lodgedDate={lodgedDate}
              caseId={lodgement.case_id}
              dhaDays={lodgement.dha_processing_days}
              stageHistory={stageHistory}
            />
            <dt className="text-slate-500">参考号</dt>
            <dd className="text-right text-slate-900">{lodgement.reference_number || '—'}</dd>
            {status !== 'pending' && (
              <>
                <dt className="text-slate-500">结果日期</dt>
                <dd className="text-right text-slate-900">{lodgement.outcome_date || '—'}</dd>
              </>
            )}
          </dl>
          {status === 'pending' && (
            <LodgementProgressBar
              lodgedDate={lodgedDate}
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
export function LodgementSection({
  caseId,
  currentStage,
}: {
  caseId: string
  currentStage: CaseStage
}) {
  const lodgements = useLodgements(caseId)
  const stageHistory = useCaseStageHistory(caseId)
  const byType = (t: LodgementType) => lodgements.data?.find((l) => l.type === t)
  const history = stageHistory.data ?? []

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
          <LodgementSlot caseId={caseId} type="nomination" lodgement={byType('nomination')} currentStage={currentStage} stageHistory={history} />
          <LodgementSlot caseId={caseId} type="visa" lodgement={byType('visa')} currentStage={currentStage} stageHistory={history} />
        </div>
      )}
    </section>
  )
}
