import type { PaymentInsert, PaymentPlanItemInsert } from '../api/payments'
import type { ReceivableStatusKind } from './statusColor'

/**
 * 「费用记录 · 收款侧列式录入」纯逻辑层（2026-06 列式优化版）。
 *
 * 一行一笔，列 = 类型 / 描述 / 金额。两种类型映射到**现有**双流模型，账目算法零改动：
 *   - 待付 owing   → 仅建应收款项（payment_plan_items），名下无收款 → 派生状态 = 待付款；
 *   - 收款 received → 建应收款项 + 一笔全额 from_client 收款（paid_at=本地今天）→ 派生状态 = 已收款。
 * 状态（已收/待付）始终从 payments 派生（getItemPaid/getCaseTotals），**不引入新状态字段**。
 * 因此「待付 → 记收款 → 已收」= 给该款项补一笔 from_client 收款；反向 = 撤销那笔收款。
 */

export const FEE_ENTRY_TYPES = ['received', 'owing'] as const
export type FeeEntryType = (typeof FEE_ENTRY_TYPES)[number]

/** 列式下拉短标签（收款 / 待付）；只读行徽章另用 RECEIVABLE_STATUS_LABELS（已收款 / 待付款）。 */
export const FEE_ENTRY_TYPE_LABELS: Record<FeeEntryType, string> = {
  received: '收款',
  owing: '待付',
}

/** 录入类型 → 应收行状态（决定徽章色，走 lib/statusColor：收款=已收·绿 / 待付=待付·黄）。 */
export const FEE_ENTRY_STATUS: Record<FeeEntryType, ReceivableStatusKind> = {
  received: 'settled',
  owing: 'owing',
}

/** 一条草稿行（UI 本地状态，未入库）。key 仅用于 React/拖拽/删除定位，绝不入库。 */
export interface DraftFeeLine {
  key: string
  type: FeeEntryType | ''
  desc: string
  amount: string
}

let seq = 0
/** 生成一行空草稿（避免 Date.now/Math.random：用递增序号保证 key 唯一稳定）。 */
export const emptyDraft = (): DraftFeeLine => ({ key: `d${seq++}`, type: '', desc: '', amount: '' })

/** 整行空白（三项都没填）→ 保存时跳过，不算非法。 */
export const isDraftBlank = (d: DraftFeeLine): boolean =>
  d.type === '' && d.desc.trim() === '' && d.amount.trim() === ''

/** 合法行：类型已选 + 描述非空 + 金额 > 0。 */
export const isDraftValid = (d: DraftFeeLine): boolean =>
  (d.type === 'received' || d.type === 'owing') && d.desc.trim() !== '' && Number(d.amount) > 0

export interface DraftValidation {
  /** 可保存的有效行（空白行已过滤掉） */
  ready: DraftFeeLine[]
  /** 可否提交：至少一行有效，且没有「填了一半」的非法行 */
  ok: boolean
  /** 非法时的提示（全空白时为 null，按钮 disabled 即可，不报错） */
  error: string | null
}

/**
 * 批量保存前校验：空白行忽略；有非空但不合法的行 → 拦截并提示；否则放行有效行。
 */
export function validateDrafts(rows: DraftFeeLine[]): DraftValidation {
  const nonBlank = rows.filter((r) => !isDraftBlank(r))
  const ready = nonBlank.filter(isDraftValid)
  if (nonBlank.length === 0) return { ready: [], ok: false, error: null }
  if (nonBlank.some((r) => !isDraftValid(r)))
    return { ready, ok: false, error: '请为每行选择类型、填写描述，金额需大于 0' }
  return { ready, ok: true, error: null }
}

/** 草稿 → 应收款项 insert（plan 已就绪）。shared=true → 共享·全案款项（is_shared，不归任何 applicant）。 */
export function draftToPlanItem(d: DraftFeeLine, planId: string, shared = false): PaymentPlanItemInsert {
  return { plan_id: planId, fee_category: d.desc.trim(), amount_due: Number(d.amount), is_shared: shared }
}

/**
 * 收款类草稿 → 一笔全额 from_client 收款 insert（已知刚建款项 id）；
 * 待付类返回 null（只建款项、不记收款）。ctx.shared=true → 共享收款（is_shared，applicant_id 恒 null）。
 */
export function draftToReceipt(
  d: DraftFeeLine,
  ctx: { caseId: string; applicantId: string | null; planItemId: string; currency: string; paidAt: string; shared?: boolean },
): PaymentInsert | null {
  if (d.type !== 'received') return null
  return {
    case_id: ctx.caseId,
    applicant_id: ctx.shared ? null : ctx.applicantId,
    direction: 'from_client',
    plan_item_id: ctx.planItemId,
    amount: Number(d.amount),
    currency: ctx.currency,
    method: 'transfer',
    paid_at: ctx.paidAt,
    fee_category: d.desc.trim(),
    is_shared: ctx.shared ?? false,
  }
}
