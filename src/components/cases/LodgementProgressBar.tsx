import { computeLodgementProgress } from '../../lib/lodgementProgress'
import type { ProgressColor } from '../../lib/lodgementProgress'

const BAR: Record<ProgressColor, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-500',
  red: 'bg-rose-500',
}
const TEXT: Record<ProgressColor, string> = {
  green: 'text-emerald-700',
  yellow: 'text-amber-700',
  red: 'text-rose-700',
}

/** 递交进度条：按 lodged_date + dha_processing_days 算剩余天数与颜色。 */
export function LodgementProgressBar({
  lodgedDate,
  dhaProcessingDays,
}: {
  lodgedDate: string | null
  dhaProcessingDays: number | null
}) {
  const p = computeLodgementProgress(lodgedDate, dhaProcessingDays)
  if (!p) return null

  const label = p.isOverdue
    ? `已超期 ${Math.abs(p.daysRemaining)} 天`
    : `预计还剩 ${p.daysRemaining} 天`

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">
          已递 {p.daysElapsed} 天 / 处理时间 {p.totalDays} 天
        </span>
        <span className={`font-medium ${TEXT[p.color]}`}>{label}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${BAR[p.color]}`} style={{ width: `${p.percentElapsed}%` }} />
      </div>
    </div>
  )
}
