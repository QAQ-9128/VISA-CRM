import { useState } from 'react'
import {
  useCaseStageHistory,
  useDeleteStageHistory,
  useUpdateStageHistory,
} from '../../hooks/queries/useCases'
import { replaceDateKeepTime } from '../../lib/stageHistory'
import { StageBadge } from './StageBadge'
import { TrashIcon } from '../ui/icons'
import { CASE_STAGE_LABELS } from '../../types/domain'
import type { CaseStageHistory } from '../../types/models'

function HistoryRow({
  h,
  onSaveDate,
  onDelete,
}: {
  h: CaseStageHistory
  onSaveDate: (dateStr: string) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)

  return (
    <li className="group flex gap-3">
      <div className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            {h.from_stage && <span className="text-slate-400">{CASE_STAGE_LABELS[h.from_stage]} →</span>}
            <StageBadge stage={h.to_stage} />
          </div>
          <button
            type="button"
            aria-label="删除该记录"
            title="删除该记录"
            onClick={onDelete}
            className="shrink-0 text-slate-300 opacity-100 transition hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100"
          >
            <TrashIcon className="size-4" />
          </button>
        </div>
        {h.note && <p className="mt-0.5 text-sm text-slate-600">{h.note}</p>}
        {editing ? (
          <input
            type="date"
            autoFocus
            defaultValue={h.effective_at.slice(0, 10)}
            onChange={(e) => {
              setEditing(false)
              if (e.target.value) onSaveDate(e.target.value)
            }}
            onBlur={() => setEditing(false)}
            className="mt-0.5 w-[9rem] rounded border border-brand/50 px-1.5 py-0.5 text-xs outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="点击修改实际发生日期"
            className="mt-0.5 text-xs text-slate-400 hover:text-brand"
          >
            📅 {new Date(h.effective_at).toLocaleString('zh-CN')}
          </button>
        )}
      </div>
    </li>
  )
}

/** 阶段变更时间线（按实际发生时间倒序）。每条可改实际发生日期、可删（不影响当前阶段）。 */
export function StageTimeline({ caseId }: { caseId: string }) {
  const history = useCaseStageHistory(caseId)
  const update = useUpdateStageHistory(caseId)
  const del = useDeleteStageHistory(caseId)

  if (history.isPending) return <p className="text-sm text-slate-400">加载时间线…</p>
  if (!history.data || history.data.length === 0) {
    return <p className="text-sm text-slate-400">暂无阶段变更记录</p>
  }

  return (
    <ol className="space-y-3">
      {history.data.map((h) => (
        <HistoryRow
          key={h.id}
          h={h}
          onSaveDate={(dateStr) =>
            update.mutate({ id: h.id, patch: { effective_at: replaceDateKeepTime(h.effective_at, dateStr) } })
          }
          onDelete={() => del.mutate(h.id)}
        />
      ))}
    </ol>
  )
}
