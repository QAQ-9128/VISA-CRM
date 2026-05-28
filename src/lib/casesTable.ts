import { utcDayDiff } from './dateDiff'
import type { Case, CaseApplicant, Customer, Lodgement } from '../types/models'

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
  /** 行角色：merged=同步(主+副同行) / primary=不同步主申行 / secondary=不同步副申行 */
  role: CaseRowRole
  /** 主申请列 */
  primaryName: string
  /** 副申请列（同步=副申合并；不同步主申行=空；不同步副申行=该副申名） */
  secondaryName: string
  /** 签证类型列（如 "482"；不同步副申行 "482 副申请"） */
  visaLabel: string
  visaSubclass: string
  nomLodgedDate: string | null
  visaLodgedDate: string | null
  /** 最近一次递交到今天的整天数（取较晚的提名/签证日期），用于排序 */
  daysSince: number
  elapsed: { months: number; days: number }
  /** 案件最后更新时间（系统自动） */
  updatedAt: string
}

/** 较晚的那个递交日期（"最近一次递交"）。 */
function latestLodged(nom: string | null, visa: string | null): string | null {
  if (nom && visa) return nom >= visa ? nom : visa
  return nom ?? visa
}

/**
 * /cases Excel 式表格行：只含「已递交」案件（提名或签证有递交日期）。
 * 同步案件 → 一案件一行（主申 + 副申分列）。
 * 不同步案件 → 主申一行（副申列空）+ 每个副申一行（签证类型 "XX 副申请"，主申列写主申名）。
 * 默认按「距今多久」降序（递交最久在前）。
 */
export function selectCaseRows(
  cases: Case[],
  lodgements: Lodgement[],
  caseApplicants: CaseApplicant[],
  customers: Customer[],
  today: Date = new Date(),
): CaseRow[] {
  const customerById: Record<string, Customer> = {}
  for (const c of customers) customerById[c.id] = c
  const subsByCase = new Map<string, string[]>()
  for (const a of caseApplicants) {
    const list = subsByCase.get(a.case_id) ?? []
    list.push(a.customer_id)
    subsByCase.set(a.case_id, list)
  }

  const rows: CaseRow[] = []
  for (const c of cases) {
    const nom = lodgements.find((l) => l.case_id === c.id && l.type === 'nomination')?.lodged_date ?? null
    const visa = lodgements.find((l) => l.case_id === c.id && l.type === 'visa')?.lodged_date ?? null
    const latest = latestLodged(nom, visa)
    if (!latest) continue // 未递交，跳过

    const daysSince = utcDayDiff(latest, today)
    const elapsed = elapsedMonthsDays(latest, today)
    const primaryName = customerById[c.customer_id]?.full_name ?? ''
    const subIds = subsByCase.get(c.id) ?? []
    const subNames = subIds.map((id) => customerById[id]?.full_name ?? '').filter(Boolean)

    const base = {
      caseId: c.id,
      caseNumber: c.case_number,
      visaSubclass: c.visa_subclass,
      nomLodgedDate: nom,
      visaLodgedDate: visa,
      daysSince,
      elapsed,
      updatedAt: c.updated_at,
    }

    if (c.sync_tracking) {
      rows.push({
        ...base,
        rowKey: c.id,
        role: 'merged',
        primaryName,
        secondaryName: subNames.join('、'),
        visaLabel: c.visa_subclass,
      })
    } else {
      // 主申一行
      rows.push({ ...base, rowKey: `${c.id}:primary`, role: 'primary', primaryName, secondaryName: '', visaLabel: c.visa_subclass })
      // 每个副申一行
      for (const id of subIds) {
        rows.push({
          ...base,
          rowKey: `${c.id}:${id}`,
          role: 'secondary',
          primaryName,
          secondaryName: customerById[id]?.full_name ?? '',
          visaLabel: `${c.visa_subclass} 副申请`,
        })
      }
    }
  }
  // 同一案件的主/副排在一起：先按距今降序分组，再同案件 caseId 聚拢，组内主申在前、副申其后
  const roleRank = (r: CaseRow) => (r.role === 'secondary' ? 1 : 0)
  return rows.sort(
    (a, b) =>
      b.daysSince - a.daysSince || a.caseId.localeCompare(b.caseId) || roleRank(a) - roleRank(b),
  )
}

export type CaseSortKey =
  | 'caseNumber'
  | 'primary'
  | 'secondary'
  | 'visa'
  | 'nomDate'
  | 'visaDate'
  | 'elapsed'
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
      case 'nomDate':
        return (a.nomLodgedDate ?? '').localeCompare(b.nomLodgedDate ?? '')
      case 'visaDate':
        return (a.visaLodgedDate ?? '').localeCompare(b.visaLodgedDate ?? '')
      case 'elapsed':
        return a.daysSince - b.daysSince
      case 'updated':
        return a.updatedAt.localeCompare(b.updatedAt)
    }
  }
  return [...rows].sort((a, b) => sign * cmp(a, b) || a.caseNumber.localeCompare(b.caseNumber))
}
