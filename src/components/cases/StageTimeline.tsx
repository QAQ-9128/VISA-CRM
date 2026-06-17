import { useState } from 'react'
import {
  useCaseStageHistory,
  useDeleteStageHistory,
  useUpdateStageHistory,
} from '../../hooks/queries/useCases'
import {
  latestStageHistory,
  recomputeStageAfterDelete,
  replaceDateKeepTime,
} from '../../lib/stageHistory'
import { todayYmd, localYmd, isFutureYmd } from '../../lib/dateRules'
import { toastError } from '../../store/ui'
import { StageBadge } from './StageBadge'
import { TrashIcon } from '../ui/icons'
import { useConfirm } from '../ui/useConfirm'
import { stageSolidColor } from '../../lib/statusColor'
import { CASE_STAGE_LABELS } from '../../types/domain'
import type { CaseStageHistory } from '../../types/models'

function HistoryRow({
  h,
  deletable,
  onSaveDate,
  onDelete,
}: {
  h: CaseStageHistory
  /** 仅「最新一条」可删（= 回退一步），避免删中间记录把链断开 */
  deletable: boolean
  onSaveDate: (dateStr: string) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)

  return (
    <li className="group flex gap-3">
      {/* 时间线圆点按目标阶段的状态类别着色（statusColor 6 类，与徽章同一来源） */}
      <div
        className="mt-1.5 size-2 shrink-0 rounded-full"
        style={{ backgroundColor: stageSolidColor(h.to_stage) }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            {h.from_stage && <span className="text-slate-400">{CASE_STAGE_LABELS[h.from_stage]} →</span>}
            <StageBadge stage={h.to_stage} />
          </div>
          {deletable && (
            <button
              type="button"
              aria-label="删除最新一条流转（回退一步）"
              title="删除最新一条流转，当前阶段回退一步"
              onClick={onDelete}
              className="shrink-0 text-slate-300 opacity-100 transition hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100"
            >
              <TrashIcon className="size-4" />
            </button>
          )}
        </div>
        {h.note && <p className="mt-0.5 text-sm text-slate-600">{h.note}</p>}
        {editing ? (
          <input
            type="date"
            autoFocus
            max={todayYmd()}
            defaultValue={h.effective_at.slice(0, 10)}
            onChange={(e) => {
              const v = e.target.value
              if (!v) return
              // 阶段记录的是已发生的事 → 禁未来日期
              if (isFutureYmd(v)) {
                toastError('实际发生日期不能是未来')
                return
              }
              onSaveDate(v)
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
            📅 {localYmd(new Date(h.effective_at))}
          </button>
        )}
      </div>
    </li>
  )
}

/**
 * 阶段变更时间线（按实际发生时间倒序）。每条可改实际发生日期。
 * 「当前阶段」是从本时间线派生的单一来源——故只允许删**最新一条**（= 回退一步）：删后当前阶段
 * 自动回到上一个，「更新至」标签/状态徽章/审理时长/相关待办随之重算（见 useDeleteStageHistory）。
 */
export function StageTimeline({ caseId }: { caseId: string }) {
  const history = useCaseStageHistory(caseId)
  const update = useUpdateStageHistory(caseId)
  const del = useDeleteStageHistory(caseId)
  const { confirm, confirmNode } = useConfirm()

  if (history.isPending) return <p className="text-sm text-slate-400">加载时间线…</p>
  if (!history.data || history.data.length === 0) {
    return <p className="text-sm text-slate-400">暂无阶段变更记录</p>
  }

  const rows = history.data
  const latestId = latestStageHistory(rows)?.id

  const handleDelete = async (h: CaseStageHistory) => {
    const back = recomputeStageAfterDelete(rows.filter((r) => r.id !== h.id), h)
    const ok = await confirm({
      title: '删除最新一条流转并回退一步？',
      description: (
        <>
          当前阶段将从「{CASE_STAGE_LABELS[h.to_stage]}」回退到「{CASE_STAGE_LABELS[back]}」，
          审理时长、状态徽章与相关待办随之重算。此操作不可撤销。
        </>
      ),
      confirmLabel: '删除并回退',
      tone: 'danger',
    })
    if (ok) del.mutate(h)
  }

  return (
    <>
      <ol className="space-y-3">
        {rows.map((h) => (
          <HistoryRow
            key={h.id}
            h={h}
            deletable={h.id === latestId}
            onSaveDate={(dateStr) =>
              update.mutate({ id: h.id, patch: { effective_at: replaceDateKeepTime(h.effective_at, dateStr) } })
            }
            onDelete={() => handleDelete(h)}
          />
        ))}
      </ol>
      {confirmNode}
    </>
  )
}
