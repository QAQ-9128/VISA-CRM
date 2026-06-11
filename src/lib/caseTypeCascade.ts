import { CASE_CATEGORIES, type CaseCategory } from '../types/domain'

/**
 * 新建/编辑案件「案件大类 → 案件类型 → 动态子字段」级联的纯配置/派生（照 图片/new_case.html 的
 * Step1+Step2 字段集；不含它的 Group/ID 生成——组模型用本站现有「案件即组」）。
 * 唯一的案件类型录入口：旧的大签证目录(VISA_CATALOG)/VisaSubclassField 已删，只保留这 8 类 + 3 个非签证大类。
 *
 * 入库映射（零迁移优先，复用现有列）：
 *  - 签证类型 → cases.visa_subclass（值 = 目录子类键：482sbs→'SBS'、配偶→'820/801' 等；
 *    非签证大类：职业评估→'Skill Assessment'(目录已有)、De Facto→'De Facto'、定制文件→'定制文件'）
 *  - 签证子类别/Stream/配偶当前阶段 → cases.visa_stream（**值与目录 stream 一致**，标签照 mock——
 *    186 的 TRT 必须存 'Temporary Residence Transition'，否则 lib/trt 的精确匹配检测会被破坏）
 *  - 担保职位 → sponsor_position；担保雇主/雇主名称 → sponsor_employer_id（仅相关类型出现，不再常驻）
 *  - 评估机构/评估职位/用途/文件类型/ABN/就读院校 → cases.case_details jsonb（0035，additive nullable）
 */

export const VISA_TYPES = [
  { key: '482', label: '482 TSS', subclass: '482' },
  { key: '482sbs', label: '482 SBS（Standard Business Sponsor）', subclass: 'SBS' },
  { key: '186', label: '186 ENS', subclass: '186' },
  { key: '407', label: '407 培训签', subclass: '407' },
  { key: '600', label: '600 旅游签', subclass: '600' },
  { key: '500', label: '500 学生签', subclass: '500' },
  { key: '820', label: '配偶签证 TR（820 / 801）', subclass: '820/801' },
  { key: '309', label: '配偶签证 PR（309 / 100）', subclass: '309/100' },
] as const
export type VisaTypeKey = (typeof VISA_TYPES)[number]['key']

export interface StreamOption {
  value: string
  label: string
}

/** 各类型的「签证子类别 / Stream / 当前阶段」下拉：value=入库 visa_stream，label=照 mock 展示。 */
export const STREAM_OPTIONS: Partial<Record<VisaTypeKey, { label: string; options: StreamOption[] }>> = {
  '482': {
    label: '签证子类别',
    options: [
      { value: 'Core Skills', label: 'Core Skill Stream' },
      { value: 'Specialist Skills', label: 'Specialist Skills Stream' },
      { value: 'Labour Agreement', label: 'Labour Agreement Stream' },
    ],
  },
  '186': {
    label: 'Stream',
    options: [
      { value: 'Temporary Residence Transition', label: 'Temporary Residence Transition (TRT)' },
      { value: 'Direct Entry', label: 'Direct Entry (DA)' },
      { value: 'Labour Agreement', label: 'Agreement' },
    ],
  },
  '600': {
    label: '签证子类别',
    options: [
      { value: 'Tourist', label: 'Tourist Stream' },
      { value: 'Business Visitor', label: 'Business Visitor Stream' },
      { value: 'Sponsored Family', label: 'Sponsored Family Stream' },
    ],
  },
  '500': {
    label: '签证子类别',
    options: [
      { value: '500', label: 'Student (500)' },
      { value: '590', label: 'Student Guardian (590)' },
    ],
  },
  '820': {
    label: '当前阶段',
    options: [
      { value: '820', label: '820（临时）' },
      { value: '801', label: '801（永久）' },
    ],
  },
  '309': {
    label: '当前阶段',
    options: [
      { value: '309', label: '309（临时）' },
      { value: '100', label: '100（永久）' },
    ],
  },
}

/** 有「担保职位」的类型（482 / 186 / 407 培训签）。 */
export const SPONSOR_TYPES: ReadonlySet<VisaTypeKey> = new Set<VisaTypeKey>(['482', '186', '407'])
/** 有「担保雇主 / 雇主名称」的类型（482 / 186 / 482sbs / 407 培训签）。 */
export const EMPLOYER_TYPES: ReadonlySet<VisaTypeKey> = new Set<VisaTypeKey>(['482', '186', '482sbs', '407'])
/** 配偶签证的静态「申请地点」（展示用，不入库——由签证类型隐含）。 */
export const STATIC_LOCATION: Partial<Record<VisaTypeKey, string>> = {
  '820': 'Onshore（澳洲境内）',
  '309': 'Offshore（澳洲境外）',
}

/** 动态子卡标题（照 mock）。 */
export const SUB_TITLES: Record<VisaTypeKey, string> = {
  '482': '482 TSS — 签证详情',
  '482sbs': '482 SBS — 担保雇主信息',
  '186': '186 ENS — 签证详情',
  '407': '407 培训签 — 签证详情',
  '600': '600 旅游签 — 签证详情',
  '500': '500 学生签 — 签证详情',
  '820': '配偶签证 TR — 签证详情',
  '309': '配偶签证 PR — 签证详情',
}

/** 职业评估机构选项（照 mock）。 */
export const ASSESS_BODIES = ['VETASSESS', 'TRA', 'ACS', 'Engineers Australia', 'ANMAC', '其他'] as const
/** De Facto 用途选项（照 mock）。 */
export const DEFACTO_PURPOSES = ['配合签证申请', '独立关系认定'] as const

/**
 * 派生入库 visa_subclass。不完整选择（没选大类 / 签证申请没选类型）→ ''（保存按钮门禁）。
 * 500 学生签按子类别折分：Student Guardian → '590'（目录两个独立子类）。
 */
export function cascadeSubclass(category: '' | CaseCategory, visaType: '' | VisaTypeKey, stream: string): string {
  if (!category) return ''
  if (category === '签证申请') {
    const t = VISA_TYPES.find((v) => v.key === visaType)
    if (!t) return ''
    if (visaType === '500') return stream === '590' ? '590' : '500'
    return t.subclass
  }
  if (category === '职业评估') return 'Skill Assessment'
  if (category === 'De Facto 关系认定') return 'De Facto'
  return '定制文件'
}

/** 派生入库 visa_stream：空 → null；500 的子类别已折进 subclass → null。 */
export function cascadeStream(visaType: '' | VisaTypeKey, stream: string): string | null {
  if (!stream) return null
  if (visaType === '500') return null
  return stream
}

/** 级联块的受控状态（CaseForm 持有；组件文件不导出常量以保 react-refresh）。 */
export interface CascadeValue {
  category: '' | CaseCategory
  visaType: '' | VisaTypeKey
  /** 签证子类别 / Stream / 配偶当前阶段（入库 visa_stream 的原始选择值） */
  stream: string
  sponsorPosition: string
  sponsorEmployerId: string
  /** 评估机构/评估职位/用途/文件类型/ABN/就读院校 → cases.case_details */
  details: Record<string, string>
}

export const EMPTY_CASCADE: CascadeValue = {
  category: '',
  visaType: '',
  stream: '',
  sponsorPosition: '',
  sponsorEmployerId: '',
  details: {},
}

/** case_details 入库前修剪：去空白值；全空 → null（列保持可空，不存空对象）。 */
export function pruneDetails(details: Record<string, string>): Record<string, string> | null {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(details)) {
    const t = v.trim()
    if (t !== '') out[k] = t
  }
  return Object.keys(out).length ? out : null
}

/**
 * 编辑模式反向填充：现有案件 → 级联受控值（新建/编辑共用同一套级联，1:1 复刻 new_case.html）。
 * 只有这 8 类签证 + 3 个非签证大类可表达；旧库里其它签证（189/494/300/父母/子女…已下线）反推不出类型
 * → 大类/类型留空（「旧值打开即空」，需重选才能保存——与全删旧目录的决定一致，不强行映射避免误存）。
 */
export function cascadeFromCase(c: {
  case_category: string | null
  visa_subclass: string
  visa_stream: string | null
  sponsor_position: string | null
  sponsor_employer_id: string | null
  case_details: Record<string, string> | null
}): CascadeValue {
  const sub = c.visa_subclass
  // 入库 visa_subclass 反推签证类型（500/590 折分到子类别；SBS 无子类别）
  let visaType: '' | VisaTypeKey = ''
  let stream = c.visa_stream ?? ''
  switch (sub) {
    case '482': visaType = '482'; break
    case 'SBS': visaType = '482sbs'; stream = ''; break
    case '186': visaType = '186'; break
    case '407': visaType = '407'; break
    case '600': visaType = '600'; break
    case '500': visaType = '500'; stream = '500'; break
    case '590': visaType = '500'; stream = '590'; break
    case '820/801': visaType = '820'; break
    case '309/100': visaType = '309'; break
  }
  // 旧目录允许、新目录已删的 stream（482 Subsequent Entrant / 600 ADS / 自由文本…）：
  // 受控下拉对目录外 value 显示空白，原样带回会在提交时隐身回写 → 与「旧值打开即空」一致，置空重选
  if (visaType && stream && visaType !== '500') {
    const opts = STREAM_OPTIONS[visaType]?.options
    if (!opts?.some((o) => o.value === stream)) stream = ''
  }

  // 大类：优先用库里存的 case_category；缺失则按签证类型 / 非签证哨兵反推（兼容未填大类的旧案）
  let category: '' | CaseCategory = ''
  if (c.case_category && (CASE_CATEGORIES as readonly string[]).includes(c.case_category)) {
    category = c.case_category as CaseCategory
  } else if (visaType) category = '签证申请'
  else if (sub === 'Skill Assessment') category = '职业评估'
  else if (sub === 'De Facto') category = 'De Facto 关系认定'
  else if (sub === '定制文件') category = '定制文件'

  // 非签证大类没有签证类型/子类别选择
  if (category !== '签证申请') {
    visaType = ''
    stream = ''
  }

  return {
    category,
    visaType,
    stream,
    sponsorPosition: c.sponsor_position ?? '',
    sponsorEmployerId: c.sponsor_employer_id ?? '',
    details: c.case_details ?? {},
  }
}
