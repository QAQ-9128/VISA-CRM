/**
 * 递交进度计算（纯函数，不入库；规格《数据模型规格.md》lodgements 节）。
 *
 * days_elapsed  = today - lodged_date
 * days_remaining = (lodged_date + dha_processing_days) - today
 * 颜色按 days_remaining / dha_processing_days：>50% 绿 / 20–50% 黄 / <20%（含超期）红
 */
import { utcDayDiff } from './dateDiff'

export type ProgressColor = 'green' | 'yellow' | 'red'

export interface LodgementProgress {
  daysElapsed: number
  daysRemaining: number
  totalDays: number
  /** 进度条已用百分比，0–100 */
  percentElapsed: number
  color: ProgressColor
  isOverdue: boolean
}

export function computeLodgementProgress(
  lodgedDate: string | null,
  dhaProcessingDays: number | null,
  today: Date = new Date(),
): LodgementProgress | null {
  if (!lodgedDate || !dhaProcessingDays || dhaProcessingDays <= 0) return null

  const daysElapsed = utcDayDiff(lodgedDate, today)
  const daysRemaining = dhaProcessingDays - daysElapsed
  const ratio = daysRemaining / dhaProcessingDays
  const percentElapsed = Math.max(0, Math.min(100, Math.round((daysElapsed / dhaProcessingDays) * 100)))

  let color: ProgressColor
  if (ratio > 0.5) color = 'green'
  else if (ratio >= 0.2) color = 'yellow'
  else color = 'red'

  return {
    daysElapsed,
    daysRemaining,
    totalDays: dhaProcessingDays,
    percentElapsed,
    color,
    isOverdue: daysRemaining < 0,
  }
}
