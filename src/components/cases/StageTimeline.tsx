import { useCaseStageHistory } from '../../hooks/queries/useCases'
import { StageBadge } from './StageBadge'
import { CASE_STAGE_LABELS } from '../../types/domain'

/** 阶段变更时间线（倒序）。 */
export function StageTimeline({ caseId }: { caseId: string }) {
  const history = useCaseStageHistory(caseId)

  if (history.isPending) return <p className="text-sm text-slate-400">加载时间线…</p>
  if (!history.data || history.data.length === 0) {
    return <p className="text-sm text-slate-400">暂无阶段变更记录</p>
  }

  return (
    <ol className="space-y-3">
      {history.data.map((h) => (
        <li key={h.id} className="flex gap-3">
          <div className="mt-1.5 size-2 shrink-0 rounded-full bg-indigo-400" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 text-sm">
              {h.from_stage && (
                <span className="text-slate-400">{CASE_STAGE_LABELS[h.from_stage]} →</span>
              )}
              <StageBadge stage={h.to_stage} />
            </div>
            {h.note && <p className="mt-0.5 text-sm text-slate-600">{h.note}</p>}
            <p className="mt-0.5 text-xs text-slate-400">
              {new Date(h.changed_at).toLocaleString('zh-CN')}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}
