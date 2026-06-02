import { formatVisaType } from './visa'
import { displayCustomerName } from './dashboardView'
import type { Case, CaseApplicant, Customer } from '../types/models'
import type { CaseStage } from '../types/domain'

/** 家庭角色：solo=单人无家庭 / primary=家庭主申 / sub=副申。 */
export type FamilyRole = 'solo' | 'primary' | 'sub'

export interface BoardCardCase {
  caseId: string
  visaLabel: string
}

/** 案件级参与者（case_applicants）：通过「作为副申参与」加入本卡某案件的人，与家庭组无关。 */
export interface BoardParticipant {
  customerId: string
  name: string
}

export interface BoardCard {
  key: string
  /** 卡主体 = 让这张卡进入该列的案件所有者（主申或副申本人）。头像/名字/签证/导航都用它。 */
  customerId: string
  stage: CaseStage
  /** 主体姓名（头像/名字用） */
  headName: string
  /** 头像取色种子（= 主体 id，各人独立） */
  seed: string
  /** 主体在家庭中的角色 */
  role: FamilyRole
  /** 主体在本阶段的案件（同一主体多案 → 名字一次、列多签证） */
  cases: BoardCardCase[]
  /** 通过 case_applicants 参与本卡案件的副申（案件级参与，非家庭组）；和主体同卡显示 */
  participants: BoardParticipant[]
  /** 主体是副申时：所属主申 id（「主申:XXX」可跳链）；否则 null */
  primaryId: string | null
  /** 主体是副申时：所属主申姓名；否则 null（解析不到也为 null，不编造） */
  primaryName: string | null
}

/**
 * 把（已过滤的可见）案件按「案件所有者 + 阶段」聚合成看板卡片：
 *  - 每张卡的主体 = 该案件的所有者（case.customer_id）本人，不再以家庭主申为头。
 *  - 副申的案件 → 卡以副申为主（头像/名字/签证全用副申），并标注所属主申。
 *  - 主申的案件 → 卡以主申为主。两者各自独立成卡、不合并、不互相串进度。
 *  - 同一主体多案、同阶段 → 一张卡（名字一次、列多签证）。
 * 家庭关系仅用于判定角色 / 标注主申（customers.primary_applicant_id），不改任何数据。
 */
export function selectBoardCards(
  cases: Case[],
  customerById: Record<string, Customer>,
  caseApplicants: CaseApplicant[] = [],
): Map<CaseStage, BoardCard[]> {
  // 被某客户 primary_applicant_id 指向的客户 = 家庭主申
  const parentIds = new Set<string>()
  for (const cust of Object.values(customerById)) {
    if (cust.primary_applicant_id) parentIds.add(cust.primary_applicant_id)
  }
  const roleOf = (cust: Customer): FamilyRole =>
    cust.primary_applicant_id ? 'sub' : parentIds.has(cust.id) ? 'primary' : 'solo'

  // case_applicants：caseId → 参与者 customer_id 列表（案件级参与，与家庭组无关）
  const participantIdsByCase = new Map<string, string[]>()
  for (const a of caseApplicants) {
    const arr = participantIdsByCase.get(a.case_id) ?? []
    arr.push(a.customer_id)
    participantIdsByCase.set(a.case_id, arr)
  }

  // 按 (案件所有者, 阶段) 聚合
  interface Group {
    applicant: Customer
    stage: CaseStage
    cases: BoardCardCase[]
  }
  const byKey = new Map<string, Group>()
  for (const c of cases) {
    const applicant = customerById[c.customer_id]
    if (!applicant) continue
    const key = `${applicant.id}:${c.current_stage}`
    const g = byKey.get(key) ?? { applicant, stage: c.current_stage, cases: [] }
    g.cases.push({ caseId: c.id, visaLabel: formatVisaType(c.visa_subclass, c.visa_stream) })
    byKey.set(key, g)
  }

  const out = new Map<CaseStage, BoardCard[]>()
  for (const [key, { applicant, stage, cases: ccs }] of byKey) {
    const role = roleOf(applicant)
    const primaryId = role === 'sub' ? applicant.primary_applicant_id : null
    const primaryCust = primaryId ? customerById[primaryId] : undefined
    const primaryName = primaryCust ? displayCustomerName(primaryCust.full_name) : null

    // 本卡各案件的案件级参与者（排除主体本人、去重、解析得到名字的才显示）
    const seen = new Set<string>()
    const participants: BoardParticipant[] = []
    for (const cc of ccs) {
      for (const pid of participantIdsByCase.get(cc.caseId) ?? []) {
        if (pid === applicant.id || seen.has(pid)) continue
        seen.add(pid)
        const pc = customerById[pid]
        if (pc) participants.push({ customerId: pid, name: displayCustomerName(pc.full_name) })
      }
    }

    const card: BoardCard = {
      key,
      customerId: applicant.id,
      stage,
      headName: displayCustomerName(applicant.full_name),
      seed: applicant.id,
      role,
      cases: ccs,
      participants,
      primaryId: primaryId ?? null,
      primaryName,
    }
    const list = out.get(stage) ?? []
    list.push(card)
    out.set(stage, list)
  }
  return out
}

// ── 「暂时无案件」列：按"人"判断谁没有自己的案件 ─────────────────
export interface NoCaseMember {
  customerId: string
  name: string
}
export interface NoCaseRelation {
  /** subHasCase=「副申:<name> · 已有案件」（主申卡上标注有案副申）；subOf=「是 <name> 的副申（主申已有案件）」 */
  kind: 'subHasCase' | 'subOf'
  customerId: string
  name: string
}
export interface NoCaseCard {
  key: string
  /** 卡主体（导航 / 建案默认对象）= 一个没有自己案件的人 */
  headId: string
  headName: string
  seed: string
  /** head 角色：primary（带无案副申的家庭主申）/ sub（主申已有案件的无案副申）/ solo（无副申单人） */
  role: FamilyRole
  /** 合并进本卡的无案副申（仅主申卡）；各自可点进客户详情 */
  members: NoCaseMember[]
  /** 关系标注行 */
  relations: NoCaseRelation[]
}

/**
 * 「暂时无案件」卡片：按"人"（不是整个家庭）判断有没有自己的案件。
 *  - 主申无案 + 无案副申 → 合并一张主申卡（列出无案副申）。
 *  - 主申无案 + 有案副申 → 主申卡标注「副申:X · 已有案件」（该副申在自己阶段列）。
 *  - 主申有案 + 无案副申 → 每个无案副申各自独立卡，标注「是 <主申> 的副申」。
 *  - 无副申单人无案 → 单卡。
 *  - 任何人一旦有自己的案件，就不在此列。
 * 有没有案件 = 拥有自己的案件(case.customer_id) 或 通过 case_applicants 参与某案件（未归档）。
 * 关系字段 = customers.primary_applicant_id；案件参与 = case_applicants（两套关系，互不混）。
 */
export function selectNoCaseCards(
  customers: Customer[],
  cases: Pick<Case, 'id' | 'customer_id' | 'is_archived'>[],
  caseApplicants: CaseApplicant[] = [],
): NoCaseCard[] {
  const active = customers.filter((c) => !c.is_archived)
  const activeCaseIds = new Set<string>()
  const hasCase = new Set<string>()
  for (const k of cases) {
    if (k.is_archived) continue
    activeCaseIds.add(k.id)
    hasCase.add(k.customer_id) // 拥有自己的案件
  }
  // 参与共享案件（case_applicants）也算「有案件」，不再误判为无案件
  for (const a of caseApplicants) if (activeCaseIds.has(a.case_id)) hasCase.add(a.customer_id)

  const parentIds = new Set<string>()
  for (const c of active) if (c.primary_applicant_id) parentIds.add(c.primary_applicant_id)
  const roleOf = (c: Customer): FamilyRole =>
    c.primary_applicant_id ? 'sub' : parentIds.has(c.id) ? 'primary' : 'solo'
  const name = (c: Customer) => displayCustomerName(c.full_name)

  const subsByRoot = new Map<string, Customer[]>()
  for (const c of active) {
    if (c.primary_applicant_id) {
      const arr = subsByRoot.get(c.primary_applicant_id) ?? []
      arr.push(c)
      subsByRoot.set(c.primary_applicant_id, arr)
    }
  }

  const cards: NoCaseCard[] = []
  for (const c of active) {
    if (roleOf(c) === 'sub') continue // 副申在其家庭根下统一处理
    const role = roleOf(c)
    const rootId = c.id
    const subs = subsByRoot.get(rootId) ?? []
    const caselessSubs = subs.filter((s) => !hasCase.has(s.id))
    const casefulSubs = subs.filter((s) => hasCase.has(s.id))

    if (!hasCase.has(rootId)) {
      // 主申 / 单人无案 → 一张以其为头的卡：合并无案副申 + 标注有案副申
      cards.push({
        key: `nocase:${rootId}`,
        headId: rootId,
        headName: name(c),
        seed: rootId,
        role,
        members: caselessSubs.map((s) => ({ customerId: s.id, name: name(s) })),
        relations: casefulSubs.map((s) => ({ kind: 'subHasCase', customerId: s.id, name: name(s) })),
      })
    } else {
      // 主申有案 → 主申不在此列；无案副申各自独立成卡（标注主申）
      for (const s of caselessSubs) {
        cards.push({
          key: `nocase:${s.id}`,
          headId: s.id,
          headName: name(s),
          seed: s.id,
          role: 'sub',
          members: [],
          relations: [{ kind: 'subOf', customerId: rootId, name: name(c) }],
        })
      }
    }
  }
  return cards
}

/** 「暂时无案件」列人数（徽标）= 各卡 head + 合并的无案成员（有案标注的人不计，他们在阶段列）。 */
export function noCasePeopleCount(cards: NoCaseCard[]): number {
  return cards.reduce((n, c) => n + 1 + c.members.length, 0)
}
