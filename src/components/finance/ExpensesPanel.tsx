import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Select } from '../ui/Select'
import { PaymentEntryForm } from './PaymentEntryForm'
import type { PaymentEntryValues } from './PaymentEntryForm'
import { useCreatePayment, useDeletePayment, useUpdatePayment } from '../../hooks/queries/usePayments'
import { useBackSource } from '../../hooks/useBackSource'
import { formatMoney } from '../../lib/money'
import { PAYMENT_DIRECTION_LABELS, PAYMENT_METHOD_LABELS } from '../../types/domain'
import type { FinancePayouts, PayoutItem } from '../../lib/finance'
import type { Referrer } from '../../types/models'

export interface FinanceCaseOption {
  caseId: string
  customerId: string
  label: string
  referrerId: string | null
}

const DIR_STYLE: Record<PayoutItem['direction'], string> = {
  to_company: 'bg-amber-100 text-amber-800',
  to_referrer: 'bg-violet-100 text-violet-800',
}
const CATEGORY_OPTIONS = [
  { value: 'to_company', label: PAYMENT_DIRECTION_LABELS.to_company },
  { value: 'to_referrer', label: PAYMENT_DIRECTION_LABELS.to_referrer },
]

/** 加支出表单（付主代理 / 付介绍人）；复用于支出栏与月度合并流水表。复用现有 useCreatePayment。 */
export function ExpenseAddForm({
  caseOptions,
  referrerById,
  onDone,
}: {
  caseOptions: FinanceCaseOption[]
  referrerById: Record<string, Referrer>
  onDone: () => void
}) {
  const [direction, setDirection] = useState<PayoutItem['direction']>('to_company')
  const [caseId, setCaseId] = useState('')
  const createPayment = useCreatePayment(caseId)

  const selected = caseOptions.find((o) => o.caseId === caseId)
  const referrerName = selected?.referrerId ? referrerById[selected.referrerId]?.name ?? null : null

  function submit(v: PaymentEntryValues) {
    if (!caseId) return
    createPayment.mutate(
      { case_id: caseId, direction, amount: v.amount, method: v.method, paid_at: v.paid_at, note: v.note },
      { onSuccess: onDone },
    )
  }

  return (
    <div className="space-y-3 rounded-lg border border-brand-100 bg-brand-50/40 p-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Select
          label="类别"
          options={CATEGORY_OPTIONS}
          value={direction}
          onChange={(e) => setDirection(e.target.value as PayoutItem['direction'])}
        />
        <Select
          label="案件（客户 · 签证）"
          placeholder="选择案件"
          options={caseOptions.map((o) => ({ value: o.caseId, label: o.label }))}
          value={caseId}
          onChange={(e) => setCaseId(e.target.value)}
        />
      </div>
      {direction === 'to_referrer' && caseId && (
        <p className="text-xs text-slate-500">
          介绍人：<span className="font-medium text-violet-700">{referrerName ?? '该客户未设置介绍人'}</span>
        </p>
      )}
      {caseId ? (
        <PaymentEntryForm submitLabel="加支出" pending={createPayment.isPending} onSubmit={submit} onCancel={onDone} />
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">请先选择案件</p>
          <Button type="button" variant="ghost" onClick={onDone}>
            取消
          </Button>
        </div>
      )}
    </div>
  )
}

function PayoutItemRow({ item, signed = false }: { item: PayoutItem; signed?: boolean }) {
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
      <li className="border-b border-slate-100 py-2.5 last:border-0">
        <PaymentEntryForm
          initial={{ amount: item.amount, method: item.method, paid_at: item.paidAt, note: item.note }}
          submitLabel="保存修改"
          pending={update.isPending}
          onSubmit={save}
          onCancel={() => setEditing(false)}
        />
      </li>
    )
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-100 py-2.5 last:border-0">
      <Badge className={DIR_STYLE[item.direction]}>{PAYMENT_DIRECTION_LABELS[item.direction]}</Badge>
      <Link to={`/cases/${item.caseId}`} state={source} className="text-sm text-slate-900 hover:underline">
        {item.customerName || '（未知客户）'}
        {item.direction === 'to_referrer' && (
          <span className="text-slate-500"> → {item.referrerName || '未指定介绍人'}</span>
        )}
      </Link>
      <span className="flex-1 text-xs text-slate-400">
        {PAYMENT_METHOD_LABELS[item.method]} · {item.paidAt || '无日期'}
        {item.note ? ` · ${item.note}` : ''}
      </span>
      <span className={`text-sm font-semibold tabular-nums ${signed ? 'text-rose-600' : 'text-slate-900'}`}>
        {`${signed ? '−' : ''}${formatMoney(item.amount)}`}
      </span>
      <Button variant="ghost" onClick={() => setEditing(true)}>
        编辑
      </Button>
      <Button
        variant="ghost"
        disabled={del.isPending}
        onClick={() => {
          if (window.confirm('删除这笔支出？')) del.mutate(item.paymentId)
        }}
      >
        删除
      </Button>
    </li>
  )
}

export function ExpensesPanel({
  payouts,
  caseOptions,
  referrerById,
  limit,
  signed = false,
}: {
  payouts: FinancePayouts
  caseOptions: FinanceCaseOption[]
  referrerById: Record<string, Referrer>
  /** 只显示前 N 笔（外层「查看全部」用）；缺省全显示 */
  limit?: number
  /** 金额加「−」并显红色（月度账目支出栏） */
  signed?: boolean
}) {
  const [adding, setAdding] = useState(false)
  const shown = limit != null ? payouts.items.slice(0, limit) : payouts.items

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          <span>
            付主代理合计 <span className="font-medium text-amber-700">{formatMoney(payouts.toCompanyTotal)}</span>
          </span>
          <span>
            付介绍人合计 <span className="font-medium text-violet-700">{formatMoney(payouts.toReferrerTotal)}</span>
          </span>
        </div>
        {!adding && (
          <Button variant="secondary" onClick={() => setAdding(true)}>
            + 加支出
          </Button>
        )}
      </div>

      {adding && (
        <ExpenseAddForm caseOptions={caseOptions} referrerById={referrerById} onDone={() => setAdding(false)} />
      )}

      {payouts.items.length === 0 ? (
        <p className="py-2 text-sm text-slate-400">暂无支出记录</p>
      ) : (
        <ul className="rounded-lg border border-slate-200 bg-white px-3">
          {shown.map((i) => (
            <PayoutItemRow key={i.paymentId} item={i} signed={signed} />
          ))}
        </ul>
      )}
    </div>
  )
}
