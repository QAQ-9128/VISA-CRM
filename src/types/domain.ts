/**
 * 领域枚举与中文映射。与 Supabase 数据库 enum 一一对应（见 supabase/migrations/0001_init.sql），
 * 并依据《数据模型规格.md》定义（澳洲移民/签证中介 CRM）。
 * UI 统一从这里取标签/顺序/配色，避免散落的魔法字符串。
 *
 * 注意：visa_subclass（签证类别，如 '482'/'189'）在 DB 用 text 存储，不做枚举；
 * 这里只提供「常用类别」下拉项，前端允许手填任意值。
 */

// ── 角色 ─────────────────────────────────────────────
export type AppRole = 'admin' | 'staff'

// ── 案件阶段（客户实际在用的 6 个，顺序即流程推进方向）──────────────
// 存储键对齐 supabase/migrations/0004（case_stage 已由 enum 改为 text + check）。
export const CASE_STAGES = [
  'todo',
  'nomination_lodged',
  'visa_lodged',
  'additional_docs',
  'granted',
  'refused',
] as const
export type CaseStage = (typeof CASE_STAGES)[number]

export const CASE_STAGE_LABELS: Record<CaseStage, string> = {
  todo: '待办',
  nomination_lodged: '提名递交',
  visa_lodged: '签证递交',
  additional_docs: '补件',
  granted: '下签',
  refused: '拒签',
}

/** Tailwind 类名片段，用于 StageBadge */
export const CASE_STAGE_STYLES: Record<CaseStage, string> = {
  todo: 'bg-slate-100 text-slate-700',
  nomination_lodged: 'bg-blue-100 text-blue-800',
  visa_lodged: 'bg-indigo-100 text-indigo-800',
  additional_docs: 'bg-orange-100 text-orange-800',
  granted: 'bg-emerald-100 text-emerald-800',
  refused: 'bg-rose-100 text-rose-800',
}

// ── 递交类型 ─────────────────────────────────────────
export const LODGEMENT_TYPES = ['nomination', 'visa'] as const
export type LodgementType = (typeof LODGEMENT_TYPES)[number]

export const LODGEMENT_TYPE_LABELS: Record<LodgementType, string> = {
  nomination: '提名',
  visa: '签证',
}

// ── 递交结果 ─────────────────────────────────────────
export const LODGEMENT_OUTCOMES = ['pending', 'approved', 'refused', 'withdrawn'] as const
export type LodgementOutcome = (typeof LODGEMENT_OUTCOMES)[number]

export const LODGEMENT_OUTCOME_LABELS: Record<LodgementOutcome, string> = {
  pending: '待决',
  approved: '批准',
  refused: '拒签',
  withdrawn: '撤回',
}

// ── 付款方向（双流账目核心 + 付介绍人佣金）────────────────
export const PAYMENT_DIRECTIONS = ['from_client', 'to_company', 'to_referrer'] as const
export type PaymentDirection = (typeof PAYMENT_DIRECTIONS)[number]

export const PAYMENT_DIRECTION_LABELS: Record<PaymentDirection, string> = {
  from_client: '客户付款',
  to_company: '付主代理',
  to_referrer: '付介绍人',
}

// ── 付款方式（advance = 垫付，0002 新增）──────────────────
export const PAYMENT_METHODS = ['cash', 'transfer', 'advance', 'wechat', 'alipay', 'card', 'other'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: '现金',
  transfer: '转账',
  advance: '垫付',
  wechat: '微信',
  alipay: '支付宝',
  card: '刷卡',
  other: '其他',
}

// ── 跟进渠道 ─────────────────────────────────────────
export const FOLLOW_UP_CHANNELS = ['call', 'wechat', 'email', 'meeting', 'other'] as const
export type FollowUpChannel = (typeof FOLLOW_UP_CHANNELS)[number]

export const FOLLOW_UP_CHANNEL_LABELS: Record<FollowUpChannel, string> = {
  call: '电话',
  wechat: '微信',
  email: '邮件',
  meeting: '会议',
  other: '其他',
}

// ── 文件类型（含体检/无犯罪/英语成绩）────────────────────
export const DOC_TYPES = [
  'passport',
  'medical',
  'police_check',
  'english_test',
  'photo',
  'employment',
  'financial',
  'form',
  'other',
] as const
export type DocType = (typeof DOC_TYPES)[number]

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  passport: '护照',
  medical: '体检',
  police_check: '无犯罪',
  english_test: '英语成绩',
  photo: '照片',
  employment: '雇佣证明',
  financial: '财务证明',
  form: '表格',
  other: '其他',
}

// ── 客户等级（可空 = 未分级）──────────────────────────
export const CUSTOMER_TIERS = ['vip', 'a', 'b', 'c'] as const
export type CustomerTier = (typeof CUSTOMER_TIERS)[number]

export const CUSTOMER_TIER_LABELS: Record<CustomerTier, string> = {
  vip: 'VIP',
  a: 'A',
  b: 'B',
  c: 'C',
}

/** 等级排序权重：vip→a→b→c，未分级(null)排最后 */
export const CUSTOMER_TIER_ORDER: Record<CustomerTier, number> = {
  vip: 0,
  a: 1,
  b: 2,
  c: 3,
}

// ── 常用签证类别（DB 为 text，允许手填其他）────────────────
export const COMMON_VISA_SUBCLASSES = [
  '482',
  '186',
  '189',
  '190',
  '494',
  '485',
  '500',
] as const
