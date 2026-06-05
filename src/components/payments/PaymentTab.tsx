import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { PaymentsSection } from './PaymentsSection'
import { PaymentsPanel } from './PaymentsPanel'
import { PayablePanel, QuickPayoutForm } from './PayablePanel'
import { RecordPaymentForm } from './RecordPaymentForm'
import { PaymentPlanForm } from './PaymentPlanForm'
import { InstallmentsPanel } from './InstallmentsPanel'
import { ReceivablesItemsArea } from '../finance/ReceivablesItemsArea'
import { ClipboardIcon, WalletIcon, AlertCircleIcon, BanknoteIcon } from '../ui/icons'
import {
  usePaymentPlan,
  usePaymentsByCase,
  useInstallments,
  useAllPlanItems,
} from '../../hooks/queries/usePayments'
import { computeAccounting } from '../../lib/accounting'
import { selectPaymentItemRows, sumPaymentItemRows, paymentItemsCsv } from '../../lib/paymentTab'
import { installmentSummaryByPlan, receivableRowStatus } from '../../lib/financeRows'
import type { FinanceStatusKind } from '../../lib/financeRows'
import { formatMoney } from '../../lib/money'

// ── 双流摘要指标卡 ───────────────────────────────────────────
const TONE: Record<string, { bg: string; fg: string }> = {
  blue: { bg: 'bg-brand-50', fg: 'text-brand' },
  green: { bg: 'bg-emerald-50', fg: 'text-emerald-600' },
  red: { bg: 'bg-rose-50', fg: 'text-rose-600' },
  amber: { bg: 'bg-amber-50', fg: 'text-amber-600' },
}
function MetricCard({ icon, tone, label, value, sub }: { icon: ReactNode; tone: keyof typeof TONE; label: string; value: string; sub?: string }) {
  const t = TONE[tone]
  return (
    <Card className="p-[18px]">
      <div className="flex items-center gap-2.5">
        <span className={`grid size-9 place-items-center rounded-[11px] ${t.bg} ${t.fg}`}>{icon}</span>
        <span className="text-[13px] font-semibold text-muted">{label}</span>
      </div>
      <div className={`mt-3 text-[22px] font-bold tabular-nums ${t.fg}`}>{value}</div>
      {sub && <div className="mt-1 text-[12px] text-faint">{sub}</div>}
    </Card>
  )
}

// 分期进度 ●●○
function ProgressDots({ paid, total }: { paid: number; total: number }) {
  if (total === 0) return <span className="text-faint">—</span>
  const n = Math.min(total, 8)
  return (
    <span className="inline-flex items-center gap-0.5 align-middle">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className={`size-2 rounded-full ${i < paid ? 'bg-emerald-500' : 'bg-line-2'}`} />
      ))}
      {total > 8 && <span className="ml-0.5 text-[10px] text-faint">…</span>}
    </span>
  )
}

const STATUS_PILL: Record<FinanceStatusKind, string> = {
  unset: 'bg-surface-2 text-faint',
  settled: 'bg-emerald-50 text-emerald-600',
  overdue: 'bg-rose-50 text-rose-600',
  pending: 'bg-amber-50 text-amber-700',
}

// ── 记账菜单 ─────────────────────────────────────────────────
type RecordAction = 'receipt' | 'company' | 'referrer' | 'plan' | 'installment'
const MENU: { key: RecordAction | 'item'; label: string }[] = [
  { key: 'receipt', label: '记一笔收款' },
  { key: 'installment', label: '创建分期' },
  { key: 'plan', label: '付款计划' },
  { key: 'item', label: '设置应收' },
  { key: 'company', label: '付主代理' },
  { key: 'referrer', label: '付介绍人' },
]

/**
 * 案件「付款 / 收款」区：双流账目的案件级视图。读写现有 payment_plans / payment_plan_items /
 * installments / payments（与财务页同源、互相链接），纯展示重排 + 补全分期入口，不改记账算法。
 */
export function PaymentTab({
  caseId,
  currency = 'AUD',
  syncTracking = true,
  customerId,
  primaryCustomerId,
}: {
  caseId: string
  currency?: string
  syncTracking?: boolean
  customerId?: string
  primaryCustomerId?: string
}) {
  const planQuery = usePaymentPlan(caseId)
  const paymentsQuery = usePaymentsByCase(caseId)
  const plan = planQuery.data
  const installmentsQuery = useInstallments(plan?.id)
  const allItemsQuery = useAllPlanItems()

  const [menuOpen, setMenuOpen] = useState(false)
  const [action, setAction] = useState<RecordAction | null>(null)
  const itemsRef = useRef<HTMLDivElement>(null)
  const instRef = useRef<HTMLDivElement>(null)

  if (!syncTracking) {
    return <PaymentsSection caseId={caseId} currency={currency} syncTracking={false} customerId={customerId} />
  }
  if (planQuery.isPending || paymentsQuery.isPending || allItemsQuery.isPending) {
    return <p className="text-sm text-faint">加载付款数据…</p>
  }

  const cur = plan?.currency || currency
  const payments = paymentsQuery.data ?? []
  const installments = installmentsQuery.data ?? []
  const items = (allItemsQuery.data ?? []).filter((i) => plan && i.plan_id === plan.id)

  const rows = selectPaymentItemRows(items, payments)
  // 合计复用 CSV 同款 sumPaymentItemRows（同口径，避免两套手算）
  const totals = sumPaymentItemRows(rows)
  const totalDue = totals.due
  const totalPaid = totals.paid
  const totalUnpaid = totals.unpaid
  const acct = computeAccounting(plan, payments)
  const payableOwed = Math.max(0, acct.companyOwes) + Math.max(0, acct.referrerOwes)

  const instSummary = installmentSummaryByPlan(installments).get(plan?.id ?? '')
  const instTotal = instSummary?.total ?? installments.length
  const instPaid = instSummary?.paid ?? installments.filter((i) => i.is_paid).length
  const status = receivableRowStatus({ receivable: totalDue, unpaid: totalUnpaid }, instSummary)

  function exportCsv() {
    const csv = '﻿' + paymentItemsCsv(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '付款计划.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function onMenu(key: RecordAction | 'item') {
    setMenuOpen(false)
    if (key === 'item') {
      setAction(null)
      itemsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (key === 'installment') {
      if (plan) {
        setAction(null)
        instRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else {
        setAction('installment') // 无计划 → 显示提示
      }
      return
    }
    setAction((prev) => (prev === key ? null : key))
  }

  return (
    <div className="space-y-5">
      {/* ① 双流摘要：总应收 / 已收 / 未收 / 应付 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard icon={<ClipboardIcon className="size-[18px]" />} tone="blue" label="总应收" value={formatMoney(totalDue, cur)} />
        <MetricCard icon={<WalletIcon className="size-[18px]" />} tone="green" label="已收" value={formatMoney(totalPaid, cur)} />
        <MetricCard icon={<AlertCircleIcon className="size-[18px]" />} tone="red" label="未收" value={formatMoney(totalUnpaid, cur)} />
        <MetricCard
          icon={<BanknoteIcon className="size-[18px]" />}
          tone="amber"
          label="应付（主代理+介绍人）"
          value={formatMoney(payableOwed, cur)}
          sub={`主代理 ${formatMoney(Math.max(0, acct.companyOwes), cur)} · 介绍人 ${formatMoney(Math.max(0, acct.referrerOwes), cur)}`}
        />
      </div>

      {/* ② 应收表（分期进度 + 状态 + 记账菜单）+ 收费项目明细 */}
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-bold tracking-[-0.01em] text-ink">应收 / 分期进度</h3>
          <div className="flex items-center gap-2">
            {rows.length > 0 && (
              <button type="button" onClick={exportCsv} className="text-[13px] font-semibold text-brand hover:text-brand-600">↗ 导出</button>
            )}
            {/* 记账菜单：每项接现有 flow */}
            <div className="relative">
              <Button variant="secondary" onClick={() => setMenuOpen((o) => !o)}>记账 ▾</Button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 z-20 mt-1 w-40 rounded-[14px] border border-line-2 bg-white p-1.5 shadow-soft">
                    {MENU.map((m) => (
                      <button key={m.key} type="button" onClick={() => onMenu(m.key)} className="block w-full rounded-[10px] px-3 py-2 text-left text-sm text-body hover:bg-surface-2">
                        {m.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 应收表（本案一行：应收/已收/未收 + 分期进度 + 状态） */}
        <div className="overflow-x-auto rounded-[12px] border border-line-2">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line-2 bg-surface-2 text-left text-xs font-medium text-muted">
                <th className="px-3 py-2">客户应收</th>
                <th className="px-3 py-2 text-right">应收</th>
                <th className="px-3 py-2 text-right">已收</th>
                <th className="px-3 py-2 text-right">未收</th>
                <th className="px-3 py-2">分期进度</th>
                <th className="px-3 py-2">状态</th>
              </tr>
            </thead>
            <tbody>
              <tr className="align-middle">
                <td className="px-3 py-2.5">
                  <span className="font-medium text-ink">本案客户应收</span>
                  <span className="ml-1.5 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand">合并核算</span>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-body">{formatMoney(totalDue, cur)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-emerald-600">{formatMoney(totalPaid, cur)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-rose-600">{totalUnpaid > 0 ? formatMoney(totalUnpaid, cur) : '—'}</td>
                <td className="px-3 py-2.5">
                  {instTotal > 0 ? (
                    <span className="flex items-center gap-2">
                      <ProgressDots paid={instPaid} total={instTotal} />
                      <span className="text-xs tabular-nums text-muted">{instPaid}/{instTotal} 期</span>
                      {instSummary?.next?.dueDate && <span className="text-xs text-faint">· 下期 {instSummary.next.dueDate}</span>}
                    </span>
                  ) : (
                    <span className="text-xs text-faint">未设分期</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_PILL[status.kind]}`}>{status.label}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 记账菜单触发的内联表单（每项接现有 flow） */}
        {action && (
          <div className="mt-4 border-t border-line pt-4">
            {action === 'receipt' && (
              <RecordPaymentForm caseId={caseId} items={items} installments={installments} currency={cur} defaultPayerCustomerId={primaryCustomerId} />
            )}
            {action === 'company' && <QuickPayoutForm caseId={caseId} direction="to_company" currency={cur} onDone={() => setAction(null)} />}
            {action === 'referrer' && <QuickPayoutForm caseId={caseId} direction="to_referrer" currency={cur} onDone={() => setAction(null)} />}
            {action === 'plan' && <PaymentPlanForm caseId={caseId} initial={plan ?? undefined} defaultCurrency={cur} onDone={() => setAction(null)} />}
            {action === 'installment' && !plan && (
              <p className="text-sm text-faint">请先在下方「收费项目」新增一条款项（自动建付款计划），再创建分期。</p>
            )}
          </div>
        )}

        {/* 收费项目明细（设置应收：分阶段 / 改应收 / 收款 / 删除 / 新增款项 / 加分期） */}
        <div ref={itemsRef} className="mt-4 border-t border-line pt-4">
          <p className="mb-2.5 text-[13px] font-semibold text-muted">收费项目明细</p>
          <ReceivablesItemsArea caseId={caseId} planId={plan?.id ?? null} currency={cur} staged={plan?.staged_billing ?? false} />
        </div>
      </Card>

      {/* ③ 分期计划明细（每期 金额 / 到期 / 状态 / 逐期记收款） */}
      {plan && (
        <Card>
          <div ref={instRef}>
            <h3 className="mb-3 text-base font-bold tracking-[-0.01em] text-ink">分期计划明细</h3>
            <InstallmentsPanel planId={plan.id} currency={cur} />
          </div>
        </Card>
      )}

      {/* ④ 主代理 / 介绍人应付 */}
      <Card>
        <PayablePanel caseId={caseId} plan={plan ?? undefined} currency={cur} acct={acct} />
      </Card>

      {/* ⑤ 收付款明细（全部流水，含收款 / 付主代理 / 付介绍人） */}
      <Card>
        <PaymentsPanel caseId={caseId} planId={plan?.id} currency={cur} />
      </Card>
    </div>
  )
}
