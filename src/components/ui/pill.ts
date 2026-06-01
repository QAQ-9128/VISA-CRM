/**
 * 状态标签（Pill / Badge）的语义色板。把语义 tone 映射到现有 Tailwind 类名，
 * 让散落各处的状态色(已结清/欠款/未设、收款方向、角色、到期等)收口到一处。
 *
 * 仅含「底色 + 文字色」，与现有 Badge shell(`rounded-full px-2 py-0.5 text-xs font-medium`)组合使用。
 * 本步只建常量、先不替换任何现有 pill（零视觉变化）。
 *
 * 注意：案件阶段(case_stage)有 12 种语义色，仍用 domain.ts 的 CASE_STAGE_STYLES，不并入 tone。
 */
export type PillTone = 'neutral' | 'muted' | 'success' | 'warning' | 'danger' | 'info' | 'accent'

export const PILL_TONES: readonly PillTone[] = ['neutral', 'muted', 'success', 'warning', 'danger', 'info', 'accent']

export const PILL_TONE: Record<PillTone, string> = {
  neutral: 'bg-slate-100 text-slate-700', // 默认/中性（如 Badge 默认、阶段 todo）
  muted: 'bg-slate-100 text-slate-500', // 弱化（如「未设应收」）
  success: 'bg-emerald-100 text-emerald-700', // 已结清 / ok
  warning: 'bg-amber-100 text-amber-800', // 临近 / 付主代理
  danger: 'bg-rose-100 text-rose-700', // 欠款 / 逾期
  info: 'bg-blue-100 text-blue-700', // 主申 / 信息
  accent: 'bg-indigo-100 text-indigo-800', // 强调/标记（如分N期、独立档案）
}
