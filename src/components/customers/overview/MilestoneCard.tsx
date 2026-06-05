import { computeLodgementProgress } from '../../../lib/lodgementProgress'
import { formatElapsed } from '../../../lib/casesTable'

/**
 * 里程碑卡：提名/签证递交日期 + 已过 + 剩余天数（真实派生，无日期留空）。
 * 获批后（approvedLabel 非空）待审时长已无意义 → 改显示绿色获批标签，隐藏「已过/剩余」。
 * 未获批时「已过 X」统一绿色（--green-d #357a52 = emerald-700）。
 */
export function MilestoneCard({
  title,
  date,
  dhaDays,
  approvedLabel = null,
}: {
  title: string
  date: string | null
  dhaDays: number | null
  /** 已获批时的替代标签（「提名获批」/「签证获批」）；未获批传 null */
  approvedLabel?: string | null
}) {
  const progress = computeLodgementProgress(date, dhaDays)
  return (
    <div className="rounded-[14px] border border-line-2 bg-surface-2/50 p-3">
      <div className="text-[12.5px] font-bold text-muted">{title}</div>
      <div className="mt-1 text-[16px] font-bold tabular-nums text-ink">{date ?? '—'}</div>
      {date &&
        (approvedLabel ? (
          <div className="mt-1 text-[12px] font-bold text-emerald-700">{approvedLabel}</div>
        ) : (
          <div className="mt-1 space-y-0.5 text-[12px] font-medium">
            <div className="text-emerald-700">已过 {formatElapsed(date)}</div>
            {progress && (
              <div className={progress.isOverdue ? 'font-semibold text-rose-600' : 'text-emerald-600'}>
                {progress.isOverdue ? `已超期 ${Math.abs(progress.daysRemaining)} 天` : `剩 ${progress.daysRemaining} 天`}
              </div>
            )}
          </div>
        ))}
    </div>
  )
}
