import { isInstallmentOverdue } from './accounting'
import { utcDayDiff } from './dateDiff'
import type { Installment } from '../types/models'
import type { ReceivableRow } from './finance'

/** 单条付款计划的分期汇总（财务富表「分期进度 / 下一期」用）。 */
export interface InstallmentSummary {
  total: number
  paid: number
  /** 下一期（最早的未付）；无未付则 null */
  next: { label: string; dueDate: string | null; overdueDays: number } | null
  /** 是否有逾期未付分期 */
  hasOverdue: boolean
}

export const EMPTY_INSTALLMENT_SUMMARY: InstallmentSummary = { total: 0, paid: 0, next: null, hasOverdue: false }

/** 按 payment_plan_id 归集分期：每计划的总期 / 已付期 / 下一期(最早未付) / 是否含逾期。 */
export function installmentSummaryByPlan(
  installments: Installment[],
  today: Date = new Date(),
): Map<string, InstallmentSummary> {
  const byPlan = new Map<string, Installment[]>()
  for (const i of installments) {
    const list = byPlan.get(i.payment_plan_id) ?? []
    list.push(i)
    byPlan.set(i.payment_plan_id, list)
  }
  const out = new Map<string, InstallmentSummary>()
  for (const [planId, list] of byPlan) {
    const total = list.length
    const paid = list.filter((i) => i.is_paid).length
    const unpaid = list
      .filter((i) => !i.is_paid)
      .sort((a, b) => (a.due_date ?? '9999-99').localeCompare(b.due_date ?? '9999-99'))
    const hasOverdue = unpaid.some((i) => isInstallmentOverdue(i.due_date, i.is_paid))
    let next: InstallmentSummary['next'] = null
    if (unpaid.length > 0) {
      const n = unpaid[0]
      const overdue = isInstallmentOverdue(n.due_date, n.is_paid)
      next = {
        label: n.label || `第 ${paid + 1} 期`,
        dueDate: n.due_date,
        overdueDays: overdue && n.due_date ? -utcDayDiff(today, n.due_date) : 0,
      }
    }
    out.set(planId, { total, paid, next, hasOverdue })
  }
  return out
}

export type FinanceStatusKind = 'unset' | 'settled' | 'overdue' | 'pending'

/** 行状态：未设应收(0) / 已结清(付清) / 逾期(有逾期分期) / 待收(欠款未逾期)。 */
export function receivableRowStatus(
  row: Pick<ReceivableRow, 'receivable' | 'unpaid'>,
  inst: InstallmentSummary = EMPTY_INSTALLMENT_SUMMARY,
): { kind: FinanceStatusKind; label: string } {
  if (row.receivable === 0) return { kind: 'unset', label: '未设应收' }
  if (row.unpaid <= 0) return { kind: 'settled', label: '已结清' }
  if (inst.hasOverdue) return { kind: 'overdue', label: '逾期' }
  return { kind: 'pending', label: '待收' }
}

/** 欠款客户数：去重的「有未付」客户。 */
export function owingCustomerCount(rows: Pick<ReceivableRow, 'customerId' | 'unpaid'>[]): number {
  const set = new Set<string>()
  for (const r of rows) if (r.unpaid > 0) set.add(r.customerId)
  return set.size
}

/** 富表一行：应收行 + 案件号 + 分期汇总 + 状态 + 总进度百分比。 */
export interface FinanceTableRow {
  row: ReceivableRow
  caseNumber: string
  inst: InstallmentSummary
  status: { kind: FinanceStatusKind; label: string }
  /** 总进度 = 已收/应收 百分比（0–100，应收为 0 时 0） */
  percent: number
}

export function buildFinanceTableRows(
  rows: ReceivableRow[],
  instByPlan: Map<string, InstallmentSummary>,
  caseNumberByCaseId: Record<string, string>,
): FinanceTableRow[] {
  return rows.map((row) => {
    const inst = (row.planId ? instByPlan.get(row.planId) : undefined) ?? EMPTY_INSTALLMENT_SUMMARY
    return {
      row,
      caseNumber: caseNumberByCaseId[row.caseId] ?? '',
      inst,
      status: receivableRowStatus(row, inst),
      percent: row.receivable > 0 ? Math.min(100, Math.round((row.paid / row.receivable) * 100)) : 0,
    }
  })
}

export interface FinanceRowFilter {
  /** 搜索：客户名 / 同案副申名 / 签证类别 / 案件号 */
  search: string
  /** 状态过滤：'' = 全部 */
  status: '' | FinanceStatusKind
}

export function filterFinanceTableRows(rows: FinanceTableRow[], f: FinanceRowFilter): FinanceTableRow[] {
  const q = f.search.trim().toLowerCase()
  return rows.filter((e) => {
    if (f.status && e.status.kind !== f.status) return false
    if (q) {
      const hay = [e.row.customerName, ...e.row.coApplicantNames, e.row.visaSubclass, e.caseNumber]
        .join(' ')
        .toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

const csvCell = (v: string | number): string => {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** 导出富表为 CSV 文本（客户/签证/应收/已收/待收/状态/分期/下一期到期）。 */
export function financeRowsToCsv(rows: FinanceTableRow[]): string {
  const header = ['客户', '签证类别', '应收', '已收', '待收', '状态', '分期', '下一期到期']
  const body = rows.map((e) =>
    [
      e.row.customerName,
      e.row.visaSubclass,
      e.row.receivable,
      e.row.paid,
      e.row.unpaid,
      e.status.label,
      e.inst.total ? `${e.inst.paid}/${e.inst.total}` : '',
      e.inst.next?.dueDate ?? '',
    ]
      .map(csvCell)
      .join(','),
  )
  return [header.join(','), ...body].join('\n')
}
