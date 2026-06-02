import { utcDayDiff } from './dateDiff'
import { formatVisaType } from './visa'
import { getLodgementLodgedDate } from './lodgementStatus'
import { CASE_STAGES } from '../types/domain'
import type { CaseStage } from '../types/domain'
import type { Case, CaseApplicant, CaseStageHistory, Customer, Lodgement } from '../types/models'

const STAGE_RANK: Record<string, number> = Object.fromEntries(CASE_STAGES.map((s, i) => [s, i]))

const MS_PER_DAY = 86_400_000

function ymd(d: string | Date): [number, number, number] {
  if (typeof d === 'string') {
    const [y, m, day] = d.split('-').map(Number)
    return [y, m, day]
  }
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()]
}

/** 从 from 到 to 的「日历」月数 + 剩余天数（DST 安全：只用日历年月日 + UTC 计天）；未来返回 {0,0}。 */
export function elapsedMonthsDays(
  from: string | Date,
  to: string | Date = new Date(),
): { months: number; days: number } {
  const [fy, fm, fd] = ymd(from)
  const [ty, tm, td] = ymd(to)
  let months = (ty - fy) * 12 + (tm - fm)
  if (td < fd) months -= 1
  if (months < 0) return { months: 0, days: 0 }
  const idx = fm - 1 + months
  const iy = fy + Math.floor(idx / 12)
  const im = ((idx % 12) + 12) % 12
  const daysInMonth = new Date(Date.UTC(iy, im + 1, 0)).getUTCDate()
  const id = Math.min(fd, daysInMonth)
  const days = Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(iy, im, id)) / MS_PER_DAY)
  return { months, days }
}

/** "X 个月 Y 天" / 不足一月 "Y 天" / 空 "—"。 */
export function formatElapsed(from: string | null | undefined, to: string | Date = new Date()): string {
  if (!from) return '—'
  const { months, days } = elapsedMonthsDays(from, to)
  return months <= 0 ? `${days} 天` : `${months} 个月 ${days} 天`
}

/**
 * 把总天数按客户 Excel 的「/30 近似法」拆成 月/天：月 = floor(总天数/30)、天 = 总天数 % 30。
 * （非日历月对齐——与 elapsedMonthsDays 不同；客户递交进度表/卡片的距今统一用这套。）
 */
export function splitWaitDays(totalDays: number): { months: number; days: number } {
  const d = Math.max(0, totalDays)
  return { months: Math.floor(d / 30), days: d % 30 }
}

/** 格式化等待天数：<30 天 → "X 天"（不显示"0 个月"）；>=30 → "X 个月 Y 天"（允许 Y=0）。 */
export function formatWaitDays(totalDays: number): string {
  const { months, days } = splitWaitDays(totalDays)
  return months <= 0 ? `${days} 天` : `${months} 个月 ${days} 天`
}

export interface WaitDays {
  /** 是否有递交日期（无则其余字段无意义） */
  lodged: boolean
  /** 案件是否已决（该案 case_stage_history 出现 granted/refused）→ 冻结 */
  frozen: boolean
  /** 递交 → 终点 的整天数（已决=到决定日；未决=到今天）。用于与 DHA 处理天数比较 */
  totalDays: number
  months: number
  days: number
  /** "X 个月 Y 天" / "Y 天" / "—" */
  label: string
}

/**
 * 单条递交（提名/签证）的「等待天数」。lodgedDate 为派生的递交日期（见 getLodgementLodgedDate）。
 *  - 案件已决：递交日 → 该案 case_stage_history 里 granted/refused 的最晚决定日(effective_at)，冻结；
 *  - 案件未决：递交日 → 今天（继续增长）。
 * 月/天换算用客户 Excel 的 /30 近似法（splitWaitDays），不用日历月。
 * stageHistory 传整个案件或全部历史均可，内部按 caseId 过滤。
 */
export function calculateWaitDays(
  lodgedDate: string | null,
  caseId: string,
  stageHistory: CaseStageHistory[],
  today: Date = new Date(),
): WaitDays {
  let decisionDay: string | null = null
  for (const h of stageHistory) {
    if (h.case_id !== caseId) continue
    if (h.to_stage !== 'granted' && h.to_stage !== 'refused') continue
    const d = (h.effective_at ?? h.changed_at).slice(0, 10)
    if (!decisionDay || d > decisionDay) decisionDay = d
  }
  const frozen = decisionDay != null
  if (!lodgedDate) return { lodged: false, frozen, totalDays: 0, months: 0, days: 0, label: '—' }
  const end: string | Date = decisionDay ?? today
  const totalDays = utcDayDiff(lodgedDate, end)
  const { months, days } = splitWaitDays(totalDays)
  return { lodged: true, frozen, totalDays, months, days, label: formatWaitDays(totalDays) }
}

/** 案件客户 + 同家庭组成员，案件客户在前，其余主申优先再按名字，"&" 连接。 */
export function joinFamilyNames(customer: Customer, customers: Customer[]): string {
  const primaryId = customer.primary_applicant_id ?? customer.id
  const others = customers
    .filter(
      (c) =>
        c.id !== customer.id &&
        !c.is_archived &&
        (c.id === primaryId || c.primary_applicant_id === primaryId),
    )
    .sort((a, b) => {
      const ap = a.primary_applicant_id ? 1 : 0
      const bp = b.primary_applicant_id ? 1 : 0
      return ap - bp || a.full_name.localeCompare(b.full_name)
    })
  return [customer.full_name, ...others.map((c) => c.full_name)].join(' & ')
}

export type CaseRowRole = 'merged' | 'primary' | 'secondary'

export interface CaseRow {
  rowKey: string
  caseId: string
  caseNumber: string
  /** 行角色：进度追踪始终同步，故恒为 merged（主+副同行）。primary/secondary 保留以兼容类型。 */
  role: CaseRowRole
  /** 主申请列 */
  primaryName: string
  /** 主申请客户 id（头像 / 名字 → 客户详情用） */
  primaryCustomerId: string
  /** 副申请列：同案副申名字合并（、连接） */
  secondaryName: string
  /** 同案副申客户 id（顺序与 secondaryName 对应）；恰好一位时其头像/名字可链到客户详情 */
  secondaryCustomerIds: string[]
  /** 签证类型列（如 "482" / "482/Core Skills"） */
  visaLabel: string
  visaSubclass: string
  /** 案件当前阶段（同一案件的主/副行共享） */
  currentStage: CaseStage
  /** 是否已递交（有提名或签证递交日期）；未递交案件日期/距今显示为占位 */
  lodged: boolean
  nomLodgedDate: string | null
  visaLodgedDate: string | null
  /** 最近一次递交到今天的整天数（取较晚的提名/签证日期），用于默认排序 */
  daysSince: number
  elapsed: { months: number; days: number }
  /** 提名递交至今（未递交提名为 null） */
  nomDaysSince: number | null
  nomElapsed: { months: number; days: number } | null
  /** 签证递交至今（未递交签证为 null） */
  visaDaysSince: number | null
  visaElapsed: { months: number; days: number } | null
  /** 案件是否已决（下签/拒签）→ 等待天数已冻结，显示灰色 */
  frozen: boolean
  /** 提名 / 签证各自的 DHA 处理天数（用于「超期」红色提示），无则 null */
  nomDhaDays: number | null
  visaDhaDays: number | null
  /** 案件最后更新时间（系统自动） */
  updatedAt: string
}

/** 较晚的那个递交日期（"最近一次递交"）。 */
function latestLodged(nom: string | null, visa: string | null): string | null {
  if (nom && visa) return nom >= visa ? nom : visa
  return nom ?? visa
}

/**
 * 递交进度 Excel 式表格行：含全部案件（未递交案件 lodged=false、日期为 null、距今 -1 排末）。
 * 进度追踪始终同步 → 一案件一行（主申 + 副申同列）。sync_tracking 只影响财务核算，不影响此表。
 * 距今口径：终态(下签/拒签)冻结 = 递交日 → 决定日（取 case_stage_history 的 effective_at）；
 * 未决 = 递交日 → 今天（继续增长）。默认按「距今多久」降序（递交最久在前）。
 */
export function selectCaseRows(
  cases: Case[],
  lodgements: Lodgement[],
  caseApplicants: CaseApplicant[],
  customers: Customer[],
  today: Date = new Date(),
  stageHistory: CaseStageHistory[] = [],
): CaseRow[] {
  const customerById: Record<string, Customer> = {}
  for (const c of customers) customerById[c.id] = c
  const subsByCase = new Map<string, string[]>()
  for (const a of caseApplicants) {
    const list = subsByCase.get(a.case_id) ?? []
    list.push(a.customer_id)
    subsByCase.set(a.case_id, list)
  }
  // 每个案件的历史（用于派生递交日期）+「决定日期」（终态冻结用）
  const histByCase = new Map<string, CaseStageHistory[]>()
  const decisionByCase = new Map<string, string>()
  for (const h of stageHistory) {
    const arr = histByCase.get(h.case_id) ?? []
    arr.push(h)
    histByCase.set(h.case_id, arr)
    if (h.to_stage === 'granted' || h.to_stage === 'refused') {
      const d = (h.effective_at ?? h.changed_at).slice(0, 10)
      const prev = decisionByCase.get(h.case_id)
      if (!prev || d > prev) decisionByCase.set(h.case_id, d)
    }
  }
  const isTerminal = (s: Case['current_stage']) => s === 'granted' || s === 'refused'

  const rows: CaseRow[] = []
  for (const c of cases) {
    const caseHist = histByCase.get(c.id) ?? []
    // 递交日期从 stage_history 派生（不再读 lodgements.lodged_date）
    const nom = getLodgementLodgedDate(caseHist, 'nomination')
    const visa = getLodgementLodgedDate(caseHist, 'visa')
    // lodgement 行仅用于取 DHA 处理天数（超期红色提示）
    const nomL = lodgements.find((l) => l.case_id === c.id && l.type === 'nomination')
    const visaL = lodgements.find((l) => l.case_id === c.id && l.type === 'visa')
    const latest = latestLodged(nom, visa)
    const lodged = latest != null
    // 终态(下签/拒签)冻结到决定日；未决则到今天（继续增长）。终态但无历史记录时回退今天。
    const decisionDay = isTerminal(c.current_stage) ? decisionByCase.get(c.id) ?? null : null
    const endRef: string | Date = decisionDay ?? today
    // 未递交：daysSince 用 -1 哨兵，默认距今降序时排在所有已递交之后
    // 月/天换算统一用 /30 近似法（splitWaitDays），与 lodgement 卡片等待天数同源、对齐客户 Excel
    const daysSince = lodged ? utcDayDiff(latest, endRef) : -1
    const elapsed = lodged ? splitWaitDays(daysSince) : { months: 0, days: 0 }
    // 提名/签证各自的距今（缺哪边哪边为 null）；终态冻结、未决到今天
    const nomDaysSince = nom ? utcDayDiff(nom, endRef) : null
    const nomElapsed = nomDaysSince != null ? splitWaitDays(nomDaysSince) : null
    const visaDaysSince = visa ? utcDayDiff(visa, endRef) : null
    const visaElapsed = visaDaysSince != null ? splitWaitDays(visaDaysSince) : null
    const primaryName = customerById[c.customer_id]?.full_name ?? ''
    const subIds = subsByCase.get(c.id) ?? []
    // 只保留能解析出名字的副申（与 subNames 顺序对应）
    const namedSubs = subIds
      .map((id) => ({ id, name: customerById[id]?.full_name ?? '' }))
      .filter((s) => s.name !== '')
    const subNames = namedSubs.map((s) => s.name)
    const visaText = formatVisaType(c.visa_subclass, c.visa_stream) // 含子类别，如 482/Core Skills

    const base = {
      caseId: c.id,
      caseNumber: c.case_number,
      visaSubclass: c.visa_subclass,
      currentStage: c.current_stage,
      lodged,
      nomLodgedDate: nom,
      visaLodgedDate: visa,
      daysSince,
      elapsed,
      nomDaysSince,
      nomElapsed,
      visaDaysSince,
      visaElapsed,
      frozen: isTerminal(c.current_stage),
      nomDhaDays: nomL?.dha_processing_days ?? null,
      visaDhaDays: visaL?.dha_processing_days ?? null,
      updatedAt: c.updated_at,
    }

    // 进度追踪始终同步：一案一行，主申 + 副申同列（sync_tracking 仅影响财务核算，不影响此表）
    rows.push({
      ...base,
      rowKey: c.id,
      role: 'merged',
      primaryName,
      primaryCustomerId: c.customer_id,
      secondaryName: subNames.join('、'),
      secondaryCustomerIds: namedSubs.map((s) => s.id),
      visaLabel: visaText,
    })
  }
  // 默认按距今降序（最近递交在前），同距今按 caseId 稳定排序
  return rows.sort((a, b) => b.daysSince - a.daysSince || a.caseId.localeCompare(b.caseId))
}

export type CaseSortKey =
  | 'caseNumber'
  | 'primary'
  | 'secondary'
  | 'visa'
  | 'stage'
  | 'nomDate'
  | 'visaDate'
  | 'elapsed'
  | 'nomElapsed'
  | 'visaElapsed'
  | 'updated'

export function sortCaseRows(rows: CaseRow[], key: CaseSortKey, dir: 'asc' | 'desc'): CaseRow[] {
  const sign = dir === 'asc' ? 1 : -1
  const cmp = (a: CaseRow, b: CaseRow): number => {
    switch (key) {
      case 'caseNumber':
        return a.caseNumber.localeCompare(b.caseNumber)
      case 'primary':
        return a.primaryName.localeCompare(b.primaryName)
      case 'secondary':
        return a.secondaryName.localeCompare(b.secondaryName)
      case 'visa':
        return a.visaLabel.localeCompare(b.visaLabel)
      case 'stage':
        return (STAGE_RANK[a.currentStage] ?? 99) - (STAGE_RANK[b.currentStage] ?? 99)
      case 'nomDate':
        return (a.nomLodgedDate ?? '').localeCompare(b.nomLodgedDate ?? '')
      case 'visaDate':
        return (a.visaLodgedDate ?? '').localeCompare(b.visaLodgedDate ?? '')
      case 'elapsed':
        return a.daysSince - b.daysSince
      case 'nomElapsed':
        return (a.nomDaysSince ?? -1) - (b.nomDaysSince ?? -1)
      case 'visaElapsed':
        return (a.visaDaysSince ?? -1) - (b.visaDaysSince ?? -1)
      case 'updated':
        return a.updatedAt.localeCompare(b.updatedAt)
    }
  }
  return [...rows].sort((a, b) => sign * cmp(a, b) || a.caseNumber.localeCompare(b.caseNumber))
}
