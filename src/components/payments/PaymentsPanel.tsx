import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { Select } from '../ui/Select'
import { Badge } from '../ui/Badge'
import {
  useCreatePayment,
  useDeletePayment,
  useInstallments,
  usePaymentsByCase,
} from '../../hooks/queries/usePayments'
import { formatMoney } from '../../lib/money'
import {
  PAYMENT_DIRECTION_LABELS,
  PAYMENT_DIRECTIONS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
} from '../../types/domain'
import type { PaymentDirection, PaymentMethod } from '../../types/domain'

const DIR_STYLE: Record<PaymentDirection, string> = {
  from_client: 'bg-emerald-100 text-emerald-800',
  to_company: 'bg-amber-100 text-amber-800',
}
const todayStr = () => new Date().toISOString().slice(0, 10)

export function PaymentsPanel({
  caseId,
  planId,
  currency,
}: {
  caseId: string
  planId?: string
  currency: string
}) {
  const payments = usePaymentsByCase(caseId)
  const create = useCreatePayment(caseId)
  const del = useDeletePayment(caseId)
  const installments = useInstallments(planId)

  const [recording, setRecording] = useState(false)
  const [direction, setDirection] = useState<PaymentDirection>('from_client')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('transfer')
  const [paidAt, setPaidAt] = useState(todayStr())
  const [installmentId, setInstallmentId] = useState('')

  function handleRecord(e: FormEvent) {
    e.preventDefault()
    create.mutate(
      {
        case_id: caseId,
        direction,
        amount: Number(amount),
        method,
        paid_at: paidAt || null,
        installment_id: installmentId || null,
      },
      {
        onSuccess: () => {
          setAmount('')
          setInstallmentId('')
          setRecording(false)
        },
      },
    )
  }

  const dirOptions = PAYMENT_DIRECTIONS.map((d) => ({ value: d, label: PAYMENT_DIRECTION_LABELS[d] }))
  const methodOptions = PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))
  const instOptions = (installments.data ?? []).map((i) => ({
    value: i.id,
    label: `${i.label || '分期'} · ${formatMoney(i.amount, currency)}`,
  }))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">收付款记录</h3>
        {!recording && (
          <Button variant="ghost" onClick={() => setRecording(true)}>
            + 记一笔
          </Button>
        )}
      </div>

      {recording && (
        <form onSubmit={handleRecord} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-2">
          <Select label="方向" options={dirOptions} value={direction} onChange={(e) => setDirection(e.target.value as PaymentDirection)} />
          <TextField label="金额" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Select label="方式" options={methodOptions} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} />
          <TextField label="日期" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          {direction === 'from_client' && instOptions.length > 0 && (
            <Select
              label="关联分期（可选）"
              placeholder="不关联"
              options={instOptions}
              value={installmentId}
              onChange={(e) => setInstallmentId(e.target.value)}
            />
          )}
          <div className="flex items-end gap-2">
            <Button type="submit" disabled={create.isPending || amount.trim() === ''}>
              保存
            </Button>
            <Button type="button" variant="ghost" onClick={() => setRecording(false)}>
              取消
            </Button>
          </div>
        </form>
      )}

      {payments.isPending ? (
        <p className="text-sm text-slate-400">加载收付款…</p>
      ) : payments.data && payments.data.length > 0 ? (
        <ul className="rounded-lg border border-slate-200 bg-white px-3">
          {payments.data.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-100 py-2.5 last:border-0">
              <Badge className={DIR_STYLE[p.direction]}>{PAYMENT_DIRECTION_LABELS[p.direction]}</Badge>
              <span className="min-w-0 flex-1 text-sm text-slate-500">
                {PAYMENT_METHOD_LABELS[p.method]} · {p.paid_at || '无日期'}
              </span>
              <span className="text-sm font-medium text-slate-900">{formatMoney(p.amount, currency)}</span>
              <Button
                variant="ghost"
                disabled={del.isPending}
                onClick={() => {
                  if (window.confirm('删除这笔收付款记录？')) del.mutate(p.id)
                }}
              >
                删除
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-400">暂无收付款记录</p>
      )}
    </div>
  )
}
