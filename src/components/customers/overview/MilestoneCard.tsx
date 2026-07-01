import { computeLodgementProgress } from '../../../lib/lodgementProgress'
import { formatWaitDays } from '../../../lib/casesTable'
import { FLOW_STATUS_LABELS, flowStatusBadgeClass, stageSolidColor } from '../../../lib/statusColor'
import type { FlowProcessing } from '../../../lib/casesTable'
import type { LodgementDerivedStatus } from '../../../lib/lodgementStatus'
import type { StageDuration } from '../../../lib/occupationalDuration'
import type { CaseStage } from '../../../types/domain'

/**
 * 里程碑卡：提名/签证递交日期 + 审理时长 + 状态徽章（与案件进度表同一来源口径）：
 *  - 审理时长 = flowProcessing 派生（审理中实时累计；已获批定格在获批日，仍显示），数值绿色；
 *  - 状态徽章 = 审理中(灰)/获批(绿)/已拒(红)，文案与配色走 lib/statusColor 单一来源；
 *  - DHA 剩余/超期只在审理中（status==='pending'）显示：获批后无意义，已拒后时长已冻结、
 *    不能再按今天实时累计「已超期」；无递交日 → 「—」、无徽章。
 */
export function MilestoneCard({
  title,
  dhaDays,
  processing,
  status,
}: {
  title: string
  dhaDays: number | null
  /** flowProcessing(type, stage, history) 的结果（lib/casesTable 单一来源） */
  processing: FlowProcessing
  /** 流程状态（getLodgementStatus 派生）；本案无此流程传 null */
  status: LodgementDerivedStatus | null
}) {
  const progress = computeLodgementProgress(processing.lodged, dhaDays)
  return (
    <div className="rounded-[14px] border border-line-2 bg-surface-2/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[12.5px] font-bold text-muted">{title}</div>
        {processing.lodged && status && (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${flowStatusBadgeClass(status)}`}>
            {FLOW_STATUS_LABELS[status]}
          </span>
        )}
      </div>
      <div className="mt-1 text-[16px] font-bold tabular-nums text-ink">{processing.lodged ?? '—'}</div>
      {processing.lodged && processing.daysSince != null && (
        <div className="mt-1 space-y-0.5 text-[12px] font-medium">
          <div className="text-muted">
            审理时长{' '}
            <span className="font-bold tabular-nums text-emerald-700">{formatWaitDays(processing.daysSince)}</span>
          </div>
          {status === 'pending' && progress && (
            <div className={progress.isOverdue ? 'font-semibold text-rose-600' : 'text-emerald-600'}>
              {progress.isOverdue ? `已超期 ${Math.abs(progress.daysRemaining)} 天` : `剩 ${progress.daysRemaining} 天`}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * 职业评估里程碑卡（简版，§7）：标题 + 单值（日期 / 结果·日期 / —）。
 * 无递交进度/审理时长（职业评估无 lodgement），值由 lib/occupationalMilestones 从阶段史派生。
 */
export function OccupationalMilestoneCard({ title, value }: { title: string; value: string | null }) {
  return (
    <div className="rounded-[14px] border border-line-2 bg-surface-2/50 p-3">
      <div className="text-[12.5px] font-bold text-muted">{title}</div>
      <div className={`mt-1 text-[16px] font-bold tabular-nums ${value ? 'text-ink' : 'text-faint'}`}>{value ?? '—'}</div>
    </div>
  )
}

/**
 * 职业评估「审理时长两段」卡（§5）：英文阶段名 + 状态色圆点 + 大数(N 天 / —) + 副说明。
 *  - duration 由 lib/occupationalDuration 从阶段史派生（本地日期；发生日→下一记录日冻结 / 仍在则累加到今天）；
 *  - 未发生 → 大数「—」、副「未发生」；
 *  - 圆点色 = stageSolidColor(stage)（lib/statusColor 单一来源，CHN/技评均蓝）。
 * 标题用英文阶段显示名（CASE_STAGE_LABELS），长名换行不截断。
 */
export function OccupationalDurationCard({
  title,
  stage,
  duration,
}: {
  title: string
  stage: CaseStage
  duration: StageDuration | null
}) {
  return (
    <div className="rounded-[14px] border border-line-2 bg-surface-2/50 p-3">
      <div className="flex items-start gap-1.5 text-[12px] font-bold leading-tight text-muted">
        <span className="mt-1 size-2 shrink-0 rounded-full" style={{ background: stageSolidColor(stage) }} />
        <span className="min-w-0">{title}</span>
      </div>
      {duration ? (
        <>
          <div className="mt-1.5 font-serif text-[19px] font-bold tabular-nums text-ink">{formatWaitDays(duration.days)}</div>
          <div className="mt-0.5 text-[11px] font-medium text-faint">
            自 {duration.start} 起 · {duration.ongoing ? '处理中' : '已用时'}
          </div>
        </>
      ) : (
        <>
          <div className="mt-1.5 font-serif text-[17px] font-bold text-faint">—</div>
          <div className="mt-0.5 text-[11px] font-medium text-faint">未发生</div>
        </>
      )}
    </div>
  )
}
