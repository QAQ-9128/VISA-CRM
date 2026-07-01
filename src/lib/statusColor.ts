import type { CaseStage } from '../types/domain'
import type { LodgementDerivedStatus } from './lodgementStatus'

/**
 * 状态 → 6 类配色的**单一来源**（2026-06 定稿）：全站所有状态徽章/圆点统一查这里，
 * 不再每个状态一个独立颜色（案件进度表状态列、提名/签证状态列、阶段流转记录、
 * 案件页阶段徽章、概览阶段分布、递交状态卡等全部走此映射）。
 *
 * 六类：紫=待办/未开始、蓝=等待外部、灰=进行中/已递交、黄=需要行动、绿=完成/获批、红=终止。
 * 色值以站内令牌为准：绿=emerald-700(#357a52)、红=rose-700(#b14e47，珊瑚系；建议值 #c0392b 让位于 token)、
 * 灰=--color-mute-bg/tx 中性 pill 令牌；紫/蓝/黄无现成令牌，取定稿十六进制配浅底。
 *
 * 注意：审理时长**数值**的绿色（text-emerald-700，时长列）是另一回事，不属此状态徽章体系。
 */

export type StatusCategory = 'todo' | 'waiting' | 'inProgress' | 'action' | 'done' | 'terminated'

export interface StatusCategoryMeta {
  /** 类别含义（汇报/图例用） */
  label: string
  /** 徽章配色（浅底 + 深字 Tailwind 类） */
  badge: string
  /** 实心十六进制色（时间线圆点 / 分布条等非 Tailwind 场景） */
  solid: string
}

export const STATUS_CATEGORY_META: Record<StatusCategory, StatusCategoryMeta> = {
  todo: { label: '待办/未开始', badge: 'bg-[#efecfb] text-[#7c6fd6]', solid: '#7c6fd6' },
  waiting: { label: '等待外部', badge: 'bg-[#e7eefc] text-[#3f7cb5]', solid: '#3f7cb5' },
  inProgress: { label: '进行中/已递交', badge: 'bg-[var(--color-mute-bg)] text-[var(--color-mute-tx)]', solid: '#7e887e' },
  action: { label: '需要行动', badge: 'bg-[#f9f1df] text-[#c08a2e]', solid: '#c08a2e' },
  done: { label: '完成/获批', badge: 'bg-emerald-50 text-emerald-700', solid: '#357a52' },
  terminated: { label: '终止', badge: 'bg-rose-50 text-rose-700', solid: '#b14e47' },
}

/**
 * 案件阶段 → 类别。表里没列到的就近归类：
 *  - drafted 已草拟 / docs_completed 补件完毕 → 进行中（草拟在办、补件已交回继续审理）；
 *  - appeal 上诉/复议 → 需要行动（异常路径需主动处理）——存疑项，已报给用户确认。
 */
export const STAGE_CATEGORY: Record<CaseStage, StatusCategory> = {
  todo: 'todo',
  drafted: 'inProgress',
  awaiting_payment: 'waiting',
  nomination_lodged: 'inProgress',
  nomination_approved: 'done',
  visa_lodged: 'inProgress',
  docs_requested: 'action',
  docs_completed: 'inProgress',
  granted: 'done',
  refused: 'terminated',
  appeal: 'action',
  withdrawn: 'terminated',
  additional_docs: 'action', // 旧「补件」
  // 职业评估专属阶段（仅 case_category='职业评估'）→ 复用现有 6 类色，不新增颜色：
  oa_chn_verification: 'waiting', // 中国学历认证·已递交 = 等待外部（蓝）
  oa_skill_submitted: 'waiting', // 职业评估·已递交 = 等待外部（蓝）
  oa_rfe: 'action', // 要求补充材料 = 需要行动（黄）
  oa_responded: 'inProgress', // 已回复 = 进行中（灰）
  oa_approved: 'done', // 已批准 = 完成（绿）
  oa_positive: 'done', // 正面结果 = 完成（绿）
  oa_negative: 'terminated', // 负面结果 = 终止（红）
  // De Facto 专属阶段（5 个，仅 case_category='De Facto 关系认定'）→ 复用现有 6 类色，零新增颜色。
  // 28days Reminder 不是阶段（是派生型自动提醒），不在此表。
  df_prep: 'inProgress', // 同居关系材料准备 = 进行中（灰 #7e887e）
  df_submitted: 'waiting', // Submitted = 等待外部（蓝 #3f7cb5）
  df_rfe: 'action', // Request Further evidence = 需要行动（黄 #c08a2e）
  df_responded: 'inProgress', // Responded = 进行中（灰 #7e887e）
  df_registered: 'done', // Registered = 完成（绿 #357a52）
}

/** 提名/签证流程状态（案件进度表两列 + 里程碑卡）：审理中=灰、获批=绿、已拒=红。 */
export const FLOW_STATUS_CATEGORY: Record<LodgementDerivedStatus, StatusCategory> = {
  pending: 'inProgress',
  approved: 'done',
  refused: 'terminated',
}

/** 流程状态徽章文案（与颜色同源，进度表/里程碑卡共用）。 */
export const FLOW_STATUS_LABELS: Record<LodgementDerivedStatus, string> = {
  pending: '审理中',
  approved: '获批',
  refused: '已拒',
}

/** 流程状态徽章配色类（FLOW_STATUS_CATEGORY → 6 类色）。 */
export function flowStatusBadgeClass(status: LodgementDerivedStatus): string {
  return STATUS_CATEGORY_META[FLOW_STATUS_CATEGORY[status]].badge
}

/** 阶段 → 类别；库里冒出的未知值兜底归「进行中」（灰，最中性）。 */
export function stageCategory(stage: CaseStage | (string & {})): StatusCategory {
  return STAGE_CATEGORY[stage as CaseStage] ?? 'inProgress'
}

/** 阶段徽章配色类（StageBadge 等）。 */
export function stageBadgeClass(stage: CaseStage | (string & {})): string {
  return STATUS_CATEGORY_META[stageCategory(stage)].badge
}

/** 阶段实心色（时间线圆点 / 概览阶段分布）。 */
export function stageSolidColor(stage: CaseStage | (string & {})): string {
  return STATUS_CATEGORY_META[stageCategory(stage)].solid
}

/**
 * 费用记录卡 · 应收行状态 → 6 类色（单一来源，禁止组件内硬编码）：
 *   已收款 settled → 完成/获批（绿）；待付款 owing → 需要行动（黄，2026-06「列式录入」改版起：收款=绿/待付=黄）；
 *   未设应收 unset → 进行中（中性灰）。
 */
export type ReceivableStatusKind = 'unset' | 'settled' | 'owing'
export const RECEIVABLE_STATUS_CATEGORY: Record<ReceivableStatusKind, StatusCategory> = {
  unset: 'inProgress',
  settled: 'done',
  owing: 'action',
}
export const RECEIVABLE_STATUS_LABELS: Record<ReceivableStatusKind, string> = {
  unset: '未设应收',
  settled: '已收款',
  owing: '待付款',
}
/** 应收行状态徽章配色类（已收款=绿 / 待付款=蓝 / 未设=灰）。 */
export function receivableStatusBadgeClass(kind: ReceivableStatusKind): string {
  return STATUS_CATEGORY_META[RECEIVABLE_STATUS_CATEGORY[kind]].badge
}

/**
 * 费用记录卡 · 支出行状态 → 色（单一来源，与收款侧对称）：
 *   待支出 pending → 需要行动（琥珀 #c08a2e，与「待付款」同源——「待」一律琥珀）；
 *   已支出 paid    → 支出语义珊瑚（§9 珊瑚只在支出出现，取站内 coral 令牌底 + 珊瑚深字）。
 * 支出珊瑚不并入 6 类的 terminated（语义不同），故单列；新增支出色一律加这里，别散落组件。
 */
export type ExpenseStatusKind = 'pending' | 'paid'
export const EXPENSE_STATUS_LABELS: Record<ExpenseStatusKind, string> = {
  pending: '待支出',
  paid: '已支出',
}
/** 已支出珊瑚徽章（浅珊瑚底 + 珊瑚深字，与本卡支出金额同色系）。 */
export const EXPENSE_PAID_BADGE = 'bg-[var(--color-coral-bg)] text-[#c25a52]'
export function expenseStatusBadgeClass(kind: ExpenseStatusKind): string {
  return kind === 'pending' ? STATUS_CATEGORY_META.action.badge : EXPENSE_PAID_BADGE
}
