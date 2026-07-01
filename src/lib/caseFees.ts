import type {
  Case,
  Customer,
  Payment,
  PaymentPlan,
  PaymentPlanItem,
} from '../types/models'
import { customerDisplayName } from './customerName'
import { receivableStatus } from './finance'
import { getItemPaid, getCaseTotals, isPayableItem } from './planItems'
import type { ReceivableRole } from './finance'

/**
 * 「费用记录卡（本案）」按参与人分账的纯派生层 —— **客户应收视图（仅 from_client）**。
 * 应付（付主代理 to_company / 付介绍人 to_referrer）不在本卡显示：双流数据与算法不删不改，
 * 完整双流总账继续在案件「付款 tab」展示；本卡只是过滤掉应付方向。
 * 底部合计 = 客户侧：应收合计 / 已收 / 未收（口径 = 款项明细 + 归属其的 from_client 收款，
 * 与财务页 selectFinanceReceivables / getCaseTotals 同口径）。
 */

type AmountLike = number | string | null | undefined
const num = (v: AmountLike): number => {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}
const round2 = (n: number): number => Math.round(n * 100) / 100

export type FeeLineStatus = 'unset' | 'settled' | 'owing'

/** 一行款项（仅应收侧）。 */
export interface CaseFeeLine {
  kind: 'receivable'
  planItemId: string
  label: string
  amount: number
  paid: number
  unpaid: number
  status: FeeLineStatus
}

/** 「共享 · 全案」组的哨兵 participantId（非真实客户，仅作 React key / 身份标识）。 */
export const SHARED_GROUP_ID = '__shared__'

export interface CaseFeeGroup {
  /**
   * 记款/新增款项时写入 applicant_id 的值：
   * 分开(sync_tracking=false) = 该参与人 id；合并(true) = null（写进案件级合并账，
   * 与财务页 merged 行同口径，保证两边应收/已收一致）。
   */
  applicantId: string | null
  /** 「共享 · 全案」组：is_shared 款项聚合，不归任何 applicant（录入时写 is_shared=true）。 */
  shared: boolean
  role: ReceivableRole
  /** 新增款项/记款的目标计划 id；null = 未建计划（懒建，applicant_id=上面的绑定值） */
  planId: string | null
  /** 组头显示/默认付款方：合并 = 案件主申，分开 = 该参与人 */
  participantId: string
  participantName: string
  lines: CaseFeeLine[]
  /** 客户侧小计（from_client 口径）：应收 / 已收 / 未收(≥0) */
  receivable: number
  paid: number
  unpaid: number
}

export interface CaseFees {
  groups: CaseFeeGroup[]
  /** 「共享 · 全案」组（恒存在，供「添加款项」入口；无共享款项时 lines 空、小计 0）。不算进 multi。 */
  sharedGroup: CaseFeeGroup
  /** 是否多账单单元 → 决定 UI 是否分组 + 是否给「添加款项」下拉（仅看客户组，不含共享组） */
  multi: boolean
  /** 客户侧合计（from_client 口径）：应收合计 / 已收 / 未收 */
  totals: { receivable: number; paid: number; unpaid: number }
  /** 「添加款项」下拉用：本案所属组成员 */
  participants: { id: string; name: string }[]
}

/**
 * 按「组内客户」分账（仅应收）：
 *   - 单元 = 案件所属组(连通集)成员（案件客户=主申在前）；现有数据里出现但不在组里的 applicant_id 也各成单元（不丢钱）。
 *   - 合并模式(applicant_id=null)的款项纯展示归到主申(案件 owner)名下 —— 主申单元覆盖 {主申, null}。
 *   - 每笔款按其 applicant_id 落到对应单元；新增款项/记款绑到该单元 participantId。
 *   - 仅 from_client：应付方向(to_company/to_referrer)不出现在本卡（数据/算法不动，付款 tab 照旧）。
 */
export function selectCaseFeeGroups(
  caseRow: Case,
  groupMemberIds: string[],
  plans: PaymentPlan[],
  payments: Payment[],
  customerById: Record<string, Customer>,
  planItems: PaymentPlanItem[],
): CaseFees {
  const caseId = caseRow.id
  const owner = caseRow.customer_id
  const casePlans = plans.filter((p) => p.case_id === caseId)
  const casePayments = payments.filter((p) => p.case_id === caseId)
  const planIds = new Set(casePlans.map((p) => p.id))
  // 仅应收款项：应付款项(kind='payable')由支出区两步流程处理，绝不进应收分账（数字与改前一致）
  const caseItems = planItems.filter((i) => planIds.has(i.plan_id) && !isPayableItem(i))

  /**
   * 构造一个单元。covered = 该单元覆盖的 applicant_id 集合（owner 含 null：合并/遗留款显示在他名下）；
   * billing = 新增款项/记款写入的 applicant_id（合并模式 owner=null，与财务页 merged 行同口径）。
   */
  // 款项行构造（应收侧，从 payments 派生已付/未付/状态）；客户组与共享组共用。
  const buildLines = (its: PaymentPlanItem[], pmts: Payment[]): CaseFeeLine[] =>
    its
      .slice()
      .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? '') || a.id.localeCompare(b.id))
      .map((it) => {
        const paid = getItemPaid(it.id, pmts)
        const unpaid = round2(Math.max(0, num(it.amount_due) - paid))
        return {
          kind: 'receivable' as const,
          planItemId: it.id,
          label: it.fee_category,
          amount: num(it.amount_due),
          paid,
          unpaid,
          status: receivableStatus({ receivable: num(it.amount_due), unpaid }).kind,
        }
      })

  const buildUnit = (participantId: string, covered: (string | null)[], billing: string | null): CaseFeeGroup => {
    const inUnit = (aid: string | null) => covered.includes(aid)
    const unitPlans = casePlans.filter((p) => inUnit(p.applicant_id ?? null))
    // ★共享款项(is_shared)绝不并进客户/主申组（即便挂 null 计划、被 owner 的 null 覆盖）→ 显式排除。
    const unitPayments = casePayments.filter((p) => !p.is_shared && inUnit(p.applicant_id ?? null))
    const unitPlanIds = new Set(unitPlans.map((p) => p.id))
    const items = caseItems.filter((i) => !i.is_shared && unitPlanIds.has(i.plan_id))
    const t = getCaseTotals(items, unitPayments)

    // 新增款项/记款目标计划 = 绑定口径的计划；无则 null → 懒建（applicant_id=billing）
    const ownPlanId = unitPlans.find((p) => (p.applicant_id ?? null) === billing)?.id ?? null
    return {
      applicantId: billing,
      shared: false,
      role: participantId === owner ? 'primary' : 'secondary',
      planId: ownPlanId,
      participantId,
      participantName: customerDisplayName(customerById[participantId]),
      lines: buildLines(items, unitPayments),
      receivable: t.totalDue,
      paid: t.totalPaid,
      unpaid: round2(Math.max(0, t.totalUnpaid)),
    }
  }

  // 「共享 · 全案」组：is_shared 应收款项/收款聚合，不归任何 applicant。恒构造（无共享款项时空、供录入入口）。
  // 目标计划 = 已承载共享款项的计划 → 复用；否则复用一个 null-applicant 计划；都无则 null（懒建 applicant_id=null）。
  const buildSharedGroup = (): CaseFeeGroup => {
    const sharedItems = caseItems.filter((i) => i.is_shared)
    const sharedPayments = casePayments.filter((p) => p.is_shared)
    const st = getCaseTotals(sharedItems, sharedPayments)
    const sharedPlanId =
      sharedItems.map((i) => i.plan_id).find(Boolean) ??
      casePlans.find((p) => (p.applicant_id ?? null) === null)?.id ??
      null
    return {
      applicantId: null,
      shared: true,
      role: 'secondary',
      planId: sharedPlanId,
      participantId: SHARED_GROUP_ID,
      participantName: '共享 · 全案',
      lines: buildLines(sharedItems, sharedPayments),
      receivable: st.totalDue,
      paid: st.totalPaid,
      unpaid: round2(Math.max(0, st.totalUnpaid)),
    }
  }

  // 分组覆盖**全部参与人**（= 案件所属组成员，与顶部「本案参与人」同源）——没记款的也出空分组（小计 0）。
  // 顺序：案件客户在前 → 其余组成员（按名）→ 现有数据里出现但不在组里的 applicant_id（不丢款项）。
  // 合并/分开只差记账绑定：合并(sync_tracking)下 owner 加款仍写 applicant_id=null（与财务页 merged 行同口径），
  // 其余成员写各自 id；分开下人人写各自 id。owner 单元两种模式都覆盖 {owner, null}（合并/遗留 null 款显示在他名下）。
  const personIds: string[] = []
  const seenP = new Set<string>()
  const addP = (id: string | null | undefined) => {
    if (id && !seenP.has(id)) { seenP.add(id); personIds.push(id) }
  }
  addP(owner)
  groupMemberIds
    .filter((id) => id !== owner)
    .sort((a, b) => customerDisplayName(customerById[a]).localeCompare(customerDisplayName(customerById[b])))
    .forEach(addP)
  const participants = personIds.map((id) => ({ id, name: customerDisplayName(customerById[id]) }))
  for (const p of casePlans) addP(p.applicant_id)
  for (const p of casePayments) addP(p.applicant_id)
  const groups = personIds.map((id) =>
    buildUnit(id, id === owner ? [owner, null] : [id], id === owner && caseRow.sync_tracking ? null : id),
  )
  const sharedGroup = buildSharedGroup()
  // 本案合计 = 客户组 Σ + 共享组（保证费用卡 hero 净额含共享；getCaseTotals 一字不改，仍按组各调）。
  const totals = {
    receivable: round2(groups.reduce((s, g) => s + g.receivable, 0) + sharedGroup.receivable),
    paid: round2(groups.reduce((s, g) => s + g.paid, 0) + sharedGroup.paid),
    unpaid: round2(groups.reduce((s, g) => s + g.unpaid, 0) + sharedGroup.unpaid),
  }

  return {
    groups,
    sharedGroup,
    multi: groups.length > 1,
    totals,
    participants,
  }
}
