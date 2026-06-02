/**
 * 递交「距今」进度条的色调与宽度（递交进度表用）。
 * 颜色按等待月数分桶（对齐设计稿与客户口径）：
 *   <3 个月 → 绿(ok) · 3–6 个月 → 琥珀(soon) · ≥6 个月 → 红(over)。
 * 月数 = 天数 / 30（与 lib/casesTable 的 /30 近似法同源）。
 * 进度条宽度 = 月数 / 参考上限(8 个月) × 100%，封顶 100%。
 * 纯函数、无副作用，便于测试与复用。
 */
export type WaitTone = 'ok' | 'soon' | 'over'

export interface WaitBar {
  tone: WaitTone
  /** 进度条宽度 0–100（百分比） */
  pct: number
}

const REF_MONTHS = 8

export function computeWaitBar(daysSince: number): WaitBar {
  const months = Math.max(0, daysSince) / 30
  const tone: WaitTone = months >= 6 ? 'over' : months >= 3 ? 'soon' : 'ok'
  const pct = Math.min(100, Math.round((months / REF_MONTHS) * 100))
  return { tone, pct }
}
