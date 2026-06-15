import {
  VISA_TYPES,
  showSponsorFields,
  type VisaTypeKey,
} from './caseTypeCascade'
import { caseParticipantIds } from './caseGroups'
import { customerDisplayName } from './customerName'
import type { Case, CaseApplicant, Customer } from '../types/models'

/**
 * 「案件 card 看板」纯派生层（替换客户列表的来源看板）：一案一卡，只读展示——
 * 卡上只 签证类别 / 担保职位 / 担保雇主 / 本案参与人 四样，**不含任何阶段/进度/金额**。
 * 数据全部从现有 case / customer / case_applicants / employers 读取，不写账目、零迁移。
 */

/** 入库 visa_subclass → 级联签证类型 key（旧/目录外子类 → ''）。 */
export function visaTypeKeyOfSubclass(sub: string): '' | VisaTypeKey {
  switch (sub) {
    case '482': return '482'
    case 'SBS': return '482sbs'
    case '186': return '186'
    case '407': return '407'
    case '600': return '600'
    case '500':
    case '590': return '500'
    case '485': return '485'
    case '820/801': return '820'
    case '309/100': return '309'
    default: return ''
  }
}

/** 卡片签证 tag 文案：干净短标签（186 带 Stream 简写）；目录外子类原样回退。 */
const VISA_LABEL: Record<string, string> = {
  '482': '482 TSS',
  SBS: '482 SBS',
  '186': '186 ENS',
  '407': '407 培训签',
  '600': '600 旅游签',
  '500': '500 学生签',
  '590': '500 学生签',
  '485': '485 毕业生工签',
  '820/801': '配偶签证 TR（820/801）',
  '309/100': '配偶签证 PR（309/100）',
  'Skill Assessment': '职业评估',
  'De Facto': 'De Facto 关系认定',
  定制文件: '定制文件',
}
const STREAM_186_SHORT: Record<string, string> = {
  'Temporary Residence Transition': 'TRT',
  'Direct Entry': 'DA',
  'Labour Agreement': 'Agreement',
}
export function caseVisaLabel(sub: string, stream?: string | null): string {
  const base = VISA_LABEL[sub] ?? (VISA_TYPES.find((v) => v.subclass === sub)?.label ?? sub)
  if (sub === '186' && stream) {
    const code = STREAM_186_SHORT[stream.trim()]
    if (code) return `${base}（${code}）`
  }
  return base
}

/** 担保签证类型（482 TSS/SBS、186 ENS、407）：才显示 担保职位 + 担保雇主。 */
const SPONSOR_VISA_TYPES: ReadonlySet<VisaTypeKey> = new Set<VisaTypeKey>(['482', '482sbs', '186', '407'])

/** 该案是否应显示担保字段：类型属担保类 且 子类别不是「副申/随行」（482 副申无自己的担保）。 */
export function caseSponsorVisible(sub: string, stream?: string | null): boolean {
  const vt = visaTypeKeyOfSubclass(sub)
  if (!vt || !SPONSOR_VISA_TYPES.has(vt)) return false
  return showSponsorFields(vt, stream ?? '')
}

export interface CaseCardParticipant {
  id: string
  name: string
  /** 关系（配偶/子女/担保人…）；主申无后缀 → null */
  relationship: string | null
}

export interface CaseCardVM {
  caseId: string
  caseNumber: string
  customerId: string
  /** 副标：主客户名（无「案件简述」字段 → 省略其后半段） */
  subtitle: string | null
  visaLabel: string
  visaSubclass: string
  /** 担保职位（仅担保类型且有值时非空，否则 null → 不渲染该行） */
  position: string | null
  employerId: string | null
  /** 担保雇主名（仅担保类型且解析到名时非空） */
  employerName: string | null
  participants: CaseCardParticipant[]
  /** 任一参与人的客户归属人 id（去空去重）——「客户归属人」筛选用 */
  ownerIds: string[]
  /** 预拼接搜索串（已小写）：案件号 + 参与人中英名 + 雇主 + 职位 */
  searchText: string
}

const lc = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()

export function selectCaseCards(
  cases: Case[],
  customerById: Record<string, Customer>,
  applicants: CaseApplicant[],
  employerNameById: Record<string, string>,
): CaseCardVM[] {
  return cases.map((c) => {
    const ids = caseParticipantIds(c, applicants)
    const participants: CaseCardParticipant[] = ids.map((id) => {
      const cust = customerById[id]
      return {
        id,
        name: customerDisplayName(cust) || '（未知客户）',
        relationship: id === c.customer_id ? null : (cust?.relationship_to_primary ?? null),
      }
    })
    const sponsorVisible = caseSponsorVisible(c.visa_subclass, c.visa_stream)
    const position = sponsorVisible && c.sponsor_position?.trim() ? c.sponsor_position.trim() : null
    const employerName =
      sponsorVisible && c.sponsor_employer_id ? (employerNameById[c.sponsor_employer_id] ?? null) : null

    const ownerIds = [
      ...new Set(ids.map((id) => customerById[id]?.owner_referrer_id).filter((x): x is string => !!x)),
    ]

    const searchParts = [c.case_number]
    for (const id of ids) {
      const cust = customerById[id]
      searchParts.push(customerDisplayName(cust), cust?.chinese_name ?? '', cust?.english_name ?? '', cust?.full_name ?? '')
    }
    if (employerName) searchParts.push(employerName)
    if (position) searchParts.push(position)

    return {
      caseId: c.id,
      caseNumber: c.case_number,
      customerId: c.customer_id,
      subtitle: customerDisplayName(customerById[c.customer_id]) || null,
      visaLabel: caseVisaLabel(c.visa_subclass, c.visa_stream),
      visaSubclass: c.visa_subclass,
      position,
      employerId: c.sponsor_employer_id,
      employerName,
      participants,
      ownerIds,
      searchText: searchParts.map(lc).filter(Boolean).join(' '),
    }
  })
}

/** 搜索命中：案件号 / 参与人名(中英) / 雇主 / 职位（空 query → 全命中）。 */
export function matchesCaseSearch(vm: CaseCardVM, query: string): boolean {
  const q = query.trim().toLowerCase()
  return q === '' || vm.searchText.includes(q)
}

export interface CaseBoardFilter {
  subclasses: ReadonlySet<string>
  employerIds: ReadonlySet<string>
  ownerIds: ReadonlySet<string>
}

export const EMPTY_CASE_BOARD_FILTER: CaseBoardFilter = {
  subclasses: new Set(),
  employerIds: new Set(),
  ownerIds: new Set(),
}

/** 筛选命中：同维度内任一即可，跨维度全部满足；客户归属人 = 任一参与人归属命中。 */
export function matchesCaseFilter(vm: CaseCardVM, f: CaseBoardFilter): boolean {
  if (f.subclasses.size > 0 && !f.subclasses.has(vm.visaSubclass)) return false
  if (f.employerIds.size > 0 && !(vm.employerId && f.employerIds.has(vm.employerId))) return false
  if (f.ownerIds.size > 0 && !vm.ownerIds.some((o) => f.ownerIds.has(o))) return false
  return true
}

export function caseBoardFilterCount(f: CaseBoardFilter): number {
  return f.subclasses.size + f.employerIds.size + f.ownerIds.size
}
