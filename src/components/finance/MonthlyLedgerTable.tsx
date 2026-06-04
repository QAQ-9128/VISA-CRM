import { useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { PaymentEntryForm } from './PaymentEntryForm'
import type { PaymentEntryValues } from './PaymentEntryForm'
import { RecordReceiptForm } from './RecordReceiptForm'
import { ExpenseAddForm } from './ExpensesPanel'
import type { FinanceCaseOption } from './ExpensesPanel'
import {
  useDeletePayment,
  useSetPaymentInvoice,
  useUpdatePayment,
} from '../../hooks/queries/usePayments'
import { getDocumentSignedUrl } from '../../api/documents'
import { useBackSource } from '../../hooks/useBackSource'
import { formatMoney } from '../../lib/money'
import {
  selectLedgerRows,
  filterLedgerRows,
  ledgerCounts,
  CUSTOMER_PAYMENT_TEXT_CLASS,
} from '../../lib/finance'
import type {
  LedgerRow,
  LedgerView,
  FinanceReceipts,
  FinancePayouts,
  ReceiptItem,
  PayoutItem,
  CustomerPaymentColor,
} from '../../lib/finance'
import type { ReceivableRow } from '../../lib/finance'
import type { Referrer } from '../../types/models'
import { PAYMENT_METHOD_LABELS, PAYMENT_DIRECTION_LABELS } from '../../types/domain'

const td = 'px-3 py-2.5 align-middle'

// 类型标签配色（按用户规格：收款=绿 / 付主代理=紫 / 付介绍人=橙）
function TypeBadge({ row }: { row: LedgerRow }) {
  if (row.kind === 'receipt') return <Badge className="bg-emerald-50 text-emerald-600">收款</Badge>
  const dir = row.item.direction
  return dir === 'to_company' ? (
    <Badge className="bg-violet-50 text-violet-700">{PAYMENT_DIRECTION_LABELS.to_company}</Badge>
  ) : (
    <Badge className="bg-amber-50 text-amber-700">{PAYMENT_DIRECTION_LABELS.to_referrer}</Badge>
  )
}

/** 收款行——复用 useUpdate/Delete/SetInvoice + PaymentEntryForm（与 ReceiptsList 同套 flow）。 */
function ReceiptRow({ item, color }: { item: ReceiptItem; color: CustomerPaymentColor }) {
  const update = useUpdatePayment(item.caseId)
  const del = useDeletePayment(item.caseId)
  const setInvoice = useSetPaymentInvoice(item.caseId)
  const source = useBackSource()
  const [editing, setEditing] = useState(false)

  function save(v: PaymentEntryValues) {
    update.mutate(
      {
        id: item.paymentId,
        patch: {
          amount: v.amount, method: v.method, paid_at: v.paid_at, note: v.note,
          fee_category: v.fee_category, from_client_customer_id: v.from_client_customer_id,
        },
      },
      { onSuccess: () => setEditing(false) },
    )
  }
  function onPickInvoice(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) setInvoice.mutate({ paymentId: item.paymentId, customerId: item.customerId, file })
  }
  async function viewInvoice() {
    if (!item.invoicePath) return
    try {
      window.open(await getDocumentSignedUrl(item.invoicePath), '_blank', 'noopener')
    } catch {
      window.alert('打开发票失败，请重试')
    }
  }

  if (editing) {
    return (
      <tr className="border-b border-line">
        <td className={td} colSpan={5}>
          <PaymentEntryForm
            initial={{ amount: item.amount, method: item.method, paid_at: item.paidAt, note: item.note, fee_category: item.feeCategory, from_client_customer_id: item.fromClientCustomerId }}
            submitLabel="保存修改"
            showFeeCategory
            showPayer
            defaultPayerCustomerId={item.customerId}
            pending={update.isPending}
            onSubmit={save}
            onCancel={() => setEditing(false)}
          />
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-line align-top">
      <td className={td}><TypeBadge row={{ kind: 'receipt', id: item.paymentId, date: item.paidAt, item }} /></td>
      <td className={td}>
        <div className="flex flex-wrap items-center gap-1.5">
          <Link to={`/customers/${item.payerId}`} state={source} className={`text-sm font-medium hover:underline ${color === 'default' ? 'text-ink' : CUSTOMER_PAYMENT_TEXT_CLASS[color]}`}>
            {item.customerName || '（未知客户）'}
          </Link>
          <Link to={`/customers/${item.customerId}?case=${item.caseId}`} state={source} className="text-xs text-faint hover:underline">· {item.visaSubclass}</Link>
          {item.feeCategory && <Badge className="bg-sky-100 text-sky-800">{item.feeCategory}</Badge>}
        </div>
      </td>
      <td className={`${td} whitespace-nowrap text-xs text-muted`}>
        {PAYMENT_METHOD_LABELS[item.method]} · {item.paidAt || '无日期'}
        {item.note ? <span className="block text-faint">{item.note}</span> : null}
      </td>
      <td className={`${td} whitespace-nowrap text-right text-sm font-semibold tabular-nums text-emerald-600`}>+{formatMoney(item.amount)}</td>
      <td className={`${td} whitespace-nowrap text-right text-xs`}>
        {item.invoicePath ? (
          <>
            <button type="button" onClick={viewInvoice} className="font-medium text-brand hover:underline">查看发票</button>
            <label className="ml-2 cursor-pointer text-faint hover:text-brand">{setInvoice.isPending ? '上传中…' : '替换'}<input type="file" hidden accept="image/*,application/pdf" disabled={setInvoice.isPending} onChange={onPickInvoice} /></label>
          </>
        ) : (
          <label className={`cursor-pointer font-medium ${setInvoice.isPending ? 'text-faint' : 'text-brand hover:underline'}`}>{setInvoice.isPending ? '上传中…' : '上传发票'}<input type="file" hidden accept="image/*,application/pdf" disabled={setInvoice.isPending} onChange={onPickInvoice} /></label>
        )}
        <button type="button" onClick={() => setEditing(true)} className="ml-2 font-medium text-brand hover:underline">编辑</button>
        <button type="button" disabled={del.isPending} onClick={() => { if (window.confirm('删除这笔收款？')) del.mutate(item.paymentId) }} className="ml-2 font-medium text-rose-500 hover:underline disabled:opacity-50">删除</button>
      </td>
    </tr>
  )
}

/** 支出行（付主代理/付介绍人）——复用 useUpdate/Delete + PaymentEntryForm（与 ExpensesPanel 同套 flow）。 */
function PayoutRow({ item }: { item: PayoutItem }) {
  const update = useUpdatePayment(item.caseId)
  const del = useDeletePayment(item.caseId)
  const source = useBackSource()
  const [editing, setEditing] = useState(false)

  function save(v: PaymentEntryValues) {
    update.mutate(
      { id: item.paymentId, patch: { amount: v.amount, method: v.method, paid_at: v.paid_at, note: v.note } },
      { onSuccess: () => setEditing(false) },
    )
  }

  if (editing) {
    return (
      <tr className="border-b border-line">
        <td className={td} colSpan={5}>
          <PaymentEntryForm
            initial={{ amount: item.amount, method: item.method, paid_at: item.paidAt, note: item.note }}
            submitLabel="保存修改"
            pending={update.isPending}
            onSubmit={save}
            onCancel={() => setEditing(false)}
          />
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-line align-top">
      <td className={td}><TypeBadge row={{ kind: 'payout', id: item.paymentId, date: item.paidAt, item }} /></td>
      <td className={td}>
        <Link to={`/customers/${item.customerId}?case=${item.caseId}`} state={source} className="text-sm text-ink hover:underline">
          {item.customerName || '（未知客户）'}
          {item.direction === 'to_referrer' && <span className="text-muted"> → {item.referrerName || '未指定介绍人'}</span>}
        </Link>
      </td>
      <td className={`${td} whitespace-nowrap text-xs text-muted`}>
        {PAYMENT_METHOD_LABELS[item.method]} · {item.paidAt || '无日期'}
        {item.note ? <span className="block text-faint">{item.note}</span> : null}
      </td>
      <td className={`${td} whitespace-nowrap text-right text-sm font-semibold tabular-nums text-rose-600`}>−{formatMoney(item.amount)}</td>
      <td className={`${td} whitespace-nowrap text-right text-xs`}>
        <button type="button" onClick={() => setEditing(true)} className="font-medium text-brand hover:underline">编辑</button>
        <button type="button" disabled={del.isPending} onClick={() => { if (window.confirm('删除这笔支出？')) del.mutate(item.paymentId) }} className="ml-2 font-medium text-rose-500 hover:underline disabled:opacity-50">删除</button>
      </td>
    </tr>
  )
}

/**
 * 月度账目「本月交易」合并流水表：收款 + 付主代理 + 付介绍人 一张表。
 * 纯展示重排——合并/排序用 selectLedgerRows；每行操作复用现有 useUpdate/Delete/SetInvoice/CreatePayment + PaymentEntryForm。
 */
export function MonthlyLedgerTable({
  receipts,
  payouts,
  colorByCase = {},
  caseOptions,
  referrerById,
  receivables,
  view,
}: {
  receipts: FinanceReceipts
  payouts: FinancePayouts
  colorByCase?: Record<string, CustomerPaymentColor>
  caseOptions: FinanceCaseOption[]
  referrerById: Record<string, Referrer>
  receivables: ReceivableRow[]
  view: LedgerView
}) {
  const [recording, setRecording] = useState(false)
  const [adding, setAdding] = useState(false)

  const allRows = useMemo(() => selectLedgerRows(receipts, payouts), [receipts, payouts])
  const counts = useMemo(() => ledgerCounts(allRows), [allRows])
  const rows = useMemo(() => filterLedgerRows(allRows, view), [allRows, view])

  return (
    <div className="space-y-3">
      {/* 表头：本月交易 · 共 N 笔(收入 X · 支出 Y) + 录入入口 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-bold text-ink">本月交易</h3>
          <p className="mt-0.5 text-[12px] text-faint">
            共 <b className="tabular-nums text-body">{counts.total}</b> 笔（收入 <b className="tabular-nums text-emerald-600">{counts.income}</b> · 支出 <b className="tabular-nums text-amber-600">{counts.expense}</b>）
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => { setRecording((v) => !v); setAdding(false) }}>{recording ? '收起' : '+ 记收款'}</Button>
          <Button variant="secondary" onClick={() => { setAdding((v) => !v); setRecording(false) }}>{adding ? '收起' : '+ 加支出'}</Button>
        </div>
      </div>

      {/* 小计（用现有计算，数值不变） */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
        <span>收入合计 <b className="tabular-nums text-emerald-600">+{formatMoney(receipts.total)}</b></span>
        <span>付主代理合计 <b className="tabular-nums text-violet-700">{formatMoney(payouts.toCompanyTotal)}</b></span>
        <span>付介绍人合计 <b className="tabular-nums text-amber-700">{formatMoney(payouts.toReferrerTotal)}</b></span>
      </div>

      {recording && <RecordReceiptForm rows={receivables} onDone={() => setRecording(false)} />}
      {adding && <ExpenseAddForm caseOptions={caseOptions} referrerById={referrerById} onDone={() => setAdding(false)} />}

      {rows.length === 0 ? (
        <p className="rounded-[12px] border border-line-2 bg-surface-2 px-4 py-6 text-center text-sm text-faint">本月暂无账目</p>
      ) : (
        <div className="overflow-x-auto rounded-[12px] border border-line-2">
          <table className="w-full min-w-[44rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line-2 bg-surface-2 text-left text-xs font-medium text-muted">
                <th className="px-3 py-2">类型</th>
                <th className="px-3 py-2">对象 / 客户</th>
                <th className="px-3 py-2">方式 · 日期</th>
                <th className="px-3 py-2 text-right">金额</th>
                <th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) =>
                r.kind === 'receipt' ? (
                  <ReceiptRow key={`r-${r.id}`} item={r.item} color={colorByCase[r.item.caseId] ?? 'default'} />
                ) : (
                  <PayoutRow key={`p-${r.id}`} item={r.item} />
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
