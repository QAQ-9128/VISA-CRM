/**
 * 领域枚举与中文映射。与 Supabase 数据库 enum 一一对应（见 supabase/migrations/0001_init.sql），
 * 并依据《数据模型规格.md》定义（澳洲移民/签证中介 CRM）。
 * UI 统一从这里取标签/顺序，避免散落的魔法字符串（状态配色见 lib/statusColor.ts）。
 *
 * 注意：visa_subclass（签证类别，如 '482'/'189'）在 DB 用 text 存储，不做枚举；
 * 这里只提供「常用类别」下拉项，前端允许手填任意值。
 */

// ── 角色 ─────────────────────────────────────────────
export type AppRole = 'admin' | 'staff'

// ── 案件阶段（顺序即流程推进方向）──────────────
// 存储键对齐 supabase/migrations/0004 + 0006 + 0016 + 0033（case_stage 为 text + check）。
// CASE_STAGES = 下拉/流程展示用（不含已废弃 additional_docs）。
export const CASE_STAGES = [
  'todo',
  'drafted',
  'awaiting_payment',
  'nomination_lodged',
  'nomination_approved',
  'visa_lodged',
  'docs_requested',
  'docs_completed',
  'granted',
  'refused',
  'appeal',
  'withdrawn',
] as const
/** 已废弃阶段：旧数据仍可能为此值，不在下拉显示，仅用于类型/标签兼容（被「要求补件」「补件完毕」替代）。 */
export const LEGACY_CASE_STAGES = ['additional_docs'] as const
export type CaseStage = (typeof CASE_STAGES)[number] | (typeof LEGACY_CASE_STAGES)[number]

export const CASE_STAGE_LABELS: Record<CaseStage, string> = {
  todo: '待办',
  drafted: '已草拟',
  awaiting_payment: '等待付款',
  nomination_lodged: '提名递交',
  nomination_approved: '提名获批',
  visa_lodged: '签证递交',
  docs_requested: '要求补件',
  docs_completed: '补件完毕',
  granted: '下签',
  refused: '拒签',
  appeal: '上诉/复议',
  withdrawn: '主动撤签',
  additional_docs: '补件', // 旧数据兼容（已被要求补件/补件完毕替代）
}

// 阶段配色：已收口到 lib/statusColor.ts（状态 → 6 类配色的单一来源），
// 旧的逐阶段 CASE_STAGE_STYLES / CASE_STAGE_COLOR 已删——UI 一律查 stageBadgeClass/stageSolidColor。

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

// ── 付款方向（双流账目核心 + 付介绍人佣金 + 垫付杂项，0034）────────────────
export const PAYMENT_DIRECTIONS = ['from_client', 'to_company', 'to_referrer', 'misc_expense'] as const
export type PaymentDirection = (typeof PAYMENT_DIRECTIONS)[number]

export const PAYMENT_DIRECTION_LABELS: Record<PaymentDirection, string> = {
  from_client: '客户付款',
  to_company: '付主代理',
  to_referrer: '付介绍人',
  misc_expense: '垫付杂项',
}

/** 支出三流（案件支出区 / 账目支出栏共用；顺序即展示顺序）。 */
export const EXPENSE_DIRECTIONS = ['to_company', 'to_referrer', 'misc_expense'] as const
export type ExpenseDirection = (typeof EXPENSE_DIRECTIONS)[number]

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

// ── 费用类别（收款记账用；DB 为 text 可空，存中文常量值）──────────────────
// 主要用于客户收款(from_client)：标注这笔钱属于哪类费用。
// 想加新类别（如「翻译费」「服务费」），在这里加一项即可，全站下拉自动跟进。
// 「其他」走手填：UI 选中 FEE_CATEGORY_OTHER 占位项后展开输入框，入库存用户自填文本（不存占位值）。
export const FEE_CATEGORIES = ['律师费', '文案费'] as const
export type FeeCategory = (typeof FEE_CATEGORIES)[number]
/** 下拉里「其他（手填）」的占位 value：仅 UI 用于触发手填输入框，绝不入库。 */
export const FEE_CATEGORY_OTHER = '__other__'

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

// ── 记录类型（records 单表：待办 / 跟进）──────────────────────────────────
export const RECORD_TYPES = ['task', 'follow_up'] as const
export type RecordType = (typeof RECORD_TYPES)[number]

// ── 跟进 emoji 标记（「记录」表里跟进行的标记；前端常量，存 text，空则默认 💬）──────
export const FOLLOW_UP_EMOJIS = ['❓', '⚠️', '‼️', '💬', 'ℹ️', '📞', '✉️'] as const
export type FollowUpEmoji = (typeof FOLLOW_UP_EMOJIS)[number]
export const DEFAULT_FOLLOW_UP_EMOJI = '💬'

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
  'invoice',
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
  invoice: '发票', // 0017 additive：ALTER TYPE public.doc_type ADD VALUE 'invoice'（手动跑）
  other: '其他',
}

// ── 客户来源（可空 = 未分类；DB 为 text，存英文键、显中文）──────────
// 用颜色标签表达「客户从哪来」，决定服务优先级心智：
//   red    = 公司派的（DB 值仍为 'red'，但显示色已改为黑/深色，避免"出事"感）
//   green  = 自己的
//   yellow = 帮别人擦屁股的
export const CLIENT_SOURCES = ['red', 'green', 'yellow'] as const
export type ClientSource = (typeof CLIENT_SOURCES)[number]

/** 完整中文标签（含说明），下拉/tooltip 用 */
export const CLIENT_SOURCE_LABELS: Record<ClientSource, string> = {
  red: '黑色（公司派的）',
  green: '绿色（自己的）',
  yellow: '黄色（帮别人擦屁股的）',
}

/** 下拉选项文案：彩色圆点(emoji) + 中文 + 说明 */
export const CLIENT_SOURCE_OPTION_LABELS: Record<ClientSource, string> = {
  red: '⚫ 黑色（公司派的）',
  green: '🟢 绿色（自己的）',
  yellow: '🟡 黄色（帮别人擦屁股的）',
}

/** 圆点徽章配色（Tailwind 实心）。'red'（公司派的）显示色改为 slate-900（柔和黑），其余不变。 */
export const CLIENT_SOURCE_DOT: Record<ClientSource, string> = {
  red: 'bg-slate-900',
  green: 'bg-green-600',
  yellow: 'bg-yellow-500',
}

// ── 客户标签（可空 = 未打标；DB 为 text，直接存中文值显示）──────────
// 给客户打一个主观标签，下拉四选一。
export const CUSTOMER_TAGS = ['傻逼', '大傻逼', '正常人', '聪明人'] as const
export type CustomerTag = (typeof CUSTOMER_TAGS)[number]

/** 标签徽章配色（浅底 + 深字 Tailwind 类）。 */
export const CUSTOMER_TAG_BADGE: Record<CustomerTag, string> = {
  傻逼: 'bg-amber-50 text-amber-700',
  大傻逼: 'bg-rose-50 text-rose-700',
  正常人: 'bg-[var(--color-mute-bg)] text-[var(--color-mute-tx)]',
  聪明人: 'bg-emerald-50 text-emerald-700',
}

// ── 人员类型（referrers 一表两用：介绍人 / 归属人，介绍人页开关切换）──────
export const REFERRER_KINDS = ['referrer', 'owner'] as const
export type ReferrerKind = (typeof REFERRER_KINDS)[number]

export const REFERRER_KIND_LABELS: Record<ReferrerKind, string> = {
  referrer: '介绍人',
  owner: '归属人',
}

// ── 性别（DB 为 text 可空；存英文键、显中文）──────────────
export const GENDERS = ['male', 'female', 'other'] as const
export type Gender = (typeof GENDERS)[number]

export const GENDER_LABELS: Record<Gender, string> = {
  male: '男',
  female: '女',
  other: '其他',
}

// ── 案件大类（cases.case_category，可空 text）────────────────
// 业务粗分类，与「案件类型」（visa_subclass）并存的两级分类；相互独立、不级联。
// DB 不做枚举（存中文文本），取值由这里约束——增改选项免迁移。
export const CASE_CATEGORIES = ['签证申请', '职业评估', 'De Facto 关系认定', '定制文件'] as const
export type CaseCategory = (typeof CASE_CATEGORIES)[number]
