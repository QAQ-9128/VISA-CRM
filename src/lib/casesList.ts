import { CASE_STAGES } from '../types/domain'
import type { CaseStage } from '../types/domain'
import { visaCategoryLabel } from './visa'
import type { CaseRow } from './casesTable'
import type { Case, Customer, Employer, Referrer } from '../types/models'

const STAGE_RANK: Record<string, number> = Object.fromEntries(CASE_STAGES.map((s, i) => [s, i]))

/** 终态阶段（"只看进行中"会排除这些）。 */
export const TERMINAL_STAGES: ReadonlySet<CaseStage> = new Set<CaseStage>([
  'granted',
  'refused',
  'withdrawn',
])

/** 案件列表视图的一行（在递交进度的 CaseRow 之上，补雇主 / 签证大类 / 紧急）。 */
export interface CaseListRow {
  caseId: string
  caseNumber: string
  customerId: string
  customerName: string
  /** 签证子类别(visa_stream)，无则 '' */
  stream: string
  visaSubclass: string
  /** 签证大类中文标签，目录外手填为 '' */
  visaCategory: string
  employerId: string | null
  employerName: string
  referrerId: string | null
  referrerName: string
  stage: CaseStage
  updatedAt: string
  /** 紧急：未决且任一递交已超过 DHA 预估处理天数 */
  urgent: boolean
}

const overdue = (days: number | null, dha: number | null) =>
  days != null && dha != null && days > dha

/**
 * 由递交进度行(CaseRow)派生案件列表行，复用其 DHA/距今计算（紧急判定不重算）。
 * 补：客户名所属雇主、签证大类标签、updatedAt。
 */
export function selectCaseListRows(
  rows: CaseRow[],
  cases: Case[],
  customers: Customer[],
  employers: Employer[],
  referrers: Referrer[] = [],
): CaseListRow[] {
  const caseById = new Map(cases.map((c) => [c.id, c]))
  const customerById = new Map(customers.map((c) => [c.id, c]))
  const employerById = new Map(employers.map((e) => [e.id, e]))
  const referrerById = new Map(referrers.map((r) => [r.id, r]))

  return rows.map((row) => {
    const c = caseById.get(row.caseId)
    const customer = c ? customerById.get(c.customer_id) : undefined
    const employerId = customer?.sponsor_employer_id ?? null
    const employerName = employerId ? employerById.get(employerId)?.name ?? '' : ''
    const referrerId = customer?.referrer_id ?? null
    const referrerName = referrerId ? referrerById.get(referrerId)?.name ?? '' : ''
    return {
      caseId: row.caseId,
      caseNumber: row.caseNumber,
      customerId: c?.customer_id ?? '',
      customerName: row.primaryName,
      stream: c?.visa_stream ?? '',
      visaSubclass: row.visaSubclass,
      visaCategory: visaCategoryLabel(row.visaSubclass),
      employerId,
      employerName,
      referrerId,
      referrerName,
      stage: row.currentStage,
      updatedAt: row.updatedAt,
      urgent:
        !row.frozen &&
        (overdue(row.nomDaysSince, row.nomDhaDays) || overdue(row.visaDaysSince, row.visaDhaDays)),
    }
  })
}

export interface CaseListFilter {
  /** 文本搜索：客户名 / 签证类别 / 大类 / 子类别 / 雇主 / 案件编号 */
  search: string
  /** 选中的阶段（空 = 不限），同维度内为「或」 */
  stages: ReadonlySet<CaseStage>
  /** 选中的签证子类别（空 = 不限） */
  subclasses: ReadonlySet<string>
  /** 选中的雇主 id（空 = 不限） */
  employerIds: ReadonlySet<string>
  /** 选中的介绍人 id（空 = 不限） */
  referrerIds: ReadonlySet<string>
  /** 只看进行中：排除终态阶段 */
  activeOnly: boolean
}

export const EMPTY_FILTER: CaseListFilter = {
  search: '',
  stages: new Set(),
  subclasses: new Set(),
  employerIds: new Set(),
  referrerIds: new Set(),
  activeOnly: false,
}

function matchesSearch(row: CaseListRow, q: string): boolean {
  const hay = [
    row.customerName,
    row.visaSubclass,
    row.visaCategory,
    row.stream,
    row.employerName,
    row.referrerName,
    row.caseNumber,
  ]
    .join(' ')
    .toLowerCase()
  return hay.includes(q)
}

/** 跨维度「且」、同维度「或」地过滤。任意维度为空集即不限。 */
export function filterCaseListRows(rows: CaseListRow[], f: CaseListFilter): CaseListRow[] {
  const q = f.search.trim().toLowerCase()
  return rows.filter((row) => {
    if (f.activeOnly && TERMINAL_STAGES.has(row.stage)) return false
    if (f.stages.size && !f.stages.has(row.stage)) return false
    if (f.subclasses.size && !f.subclasses.has(row.visaSubclass)) return false
    if (f.employerIds.size && (!row.employerId || !f.employerIds.has(row.employerId))) return false
    if (f.referrerIds.size && (!row.referrerId || !f.referrerIds.has(row.referrerId))) return false
    if (q && !matchesSearch(row, q)) return false
    return true
  })
}

export interface CaseListFacets {
  stages: CaseStage[]
  subclasses: string[]
  employers: { id: string; name: string }[]
  referrers: { id: string; name: string }[]
}

/**
 * 案件筛选项：
 *  - 阶段：全部流程阶段（固定枚举）。
 *  - 签证类别：**只列已有案件出现过的**子类（没案件的不显示）。
 *  - 雇主 / 介绍人：未归档主数据全集（暂无案件也列出，便于按人筛）。
 */
export function caseFilterFacets(
  rows: CaseListRow[],
  employers: Employer[],
  referrers: Referrer[],
): CaseListFacets {
  const subSet = new Set<string>()
  for (const r of rows) if (r.visaSubclass) subSet.add(r.visaSubclass)
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)
  return {
    stages: [...CASE_STAGES],
    subclasses: [...subSet].sort((a, b) => a.localeCompare(b)),
    employers: employers.map((e) => ({ id: e.id, name: e.name })).sort(byName),
    referrers: referrers.map((r) => ({ id: r.id, name: r.name })).sort(byName),
  }
}

/** 当前数据里实际出现的可筛项（用于构建筛选 chip），按合理顺序排好。 */
export function caseListFacets(rows: CaseListRow[]): CaseListFacets {
  const stages = new Set<CaseStage>()
  const subclasses = new Set<string>()
  const employers = new Map<string, string>()
  const referrers = new Map<string, string>()
  for (const r of rows) {
    stages.add(r.stage)
    if (r.visaSubclass) subclasses.add(r.visaSubclass)
    if (r.employerId) employers.set(r.employerId, r.employerName)
    if (r.referrerId) referrers.set(r.referrerId, r.referrerName)
  }
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)
  return {
    stages: [...stages].sort((a, b) => (STAGE_RANK[a] ?? 99) - (STAGE_RANK[b] ?? 99)),
    subclasses: [...subclasses].sort((a, b) => a.localeCompare(b)),
    employers: [...employers].map(([id, name]) => ({ id, name })).sort(byName),
    referrers: [...referrers].map(([id, name]) => ({ id, name })).sort(byName),
  }
}
