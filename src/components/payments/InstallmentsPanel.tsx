import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { useConfirm } from '../ui/useConfirm'
import {
  useCreateInstallment,
  useDeleteInstallment,
  useInstallments,
  useUpdateInstallment,
} from '../../hooks/queries/usePayments'
import { isInstallmentOverdue } from '../../lib/accounting'
import { formatMoney } from '../../lib/money'
import type { Installment } from '../../types/models'

import { todayYmd } from '../../lib/dateRules'

// 标记已付的日期取本地日历日——toISOString 是 UTC 日，本地清晨会落到昨天甚至上个月，污染月度账目
const todayStr = todayYmd

function InstallmentRow({ planId, inst, currency }: { planId: string; inst: Installment; currency: string }) {
  const update = useUpdateInstallment(planId)
  const del = useDeleteInstallment(planId)
  const { confirm, confirmNode } = useConfirm()
  const overdue = isInstallmentOverdue(inst.due_date, inst.is_paid)

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-100 py-2.5 last:border-0">
      <input
        type="checkbox"
        checked={inst.is_paid}
        disabled={update.isPending}
        onChange={(e) =>
          update.mutate({
            id: inst.id,
            patch: { is_paid: e.target.checked, paid_at: e.target.checked ? todayStr() : null },
          })
        }
        className="size-4 rounded border-slate-300 text-brand focus:ring-brand"
      />
      <span className="min-w-0 flex-1 truncate text-sm text-slate-900">{inst.label || '分期'}</span>
      <span className={`text-xs ${overdue ? 'font-medium text-rose-600' : 'text-slate-500'}`}>
        {inst.due_date ? `应付 ${inst.due_date}` : '无日期'}
        {overdue ? ' · 逾期' : ''}
      </span>
      <span className="text-sm font-medium text-slate-900">{formatMoney(inst.amount, currency)}</span>
      <Button
        variant="ghost"
        disabled={del.isPending}
        onClick={async () => {
          if (await confirm({ title: '删除分期', description: '删除该分期节点？', confirmLabel: '删除', tone: 'danger' }))
            del.mutate(inst.id)
        }}
      >
        删除
      </Button>
      {confirmNode}
    </li>
  )
}

export function InstallmentsPanel({ planId, currency }: { planId: string; currency: string }) {
  const installments = useInstallments(planId)
  const create = useCreateInstallment(planId)
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [amount, setAmount] = useState('')

  function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!(Number(amount) > 0)) return
    create.mutate(
      {
        payment_plan_id: planId,
        label: label.trim() || null,
        due_date: dueDate || null,
        amount: Number(amount),
      },
      {
        onSuccess: () => {
          setLabel('')
          setDueDate('')
          setAmount('')
          setAdding(false)
        },
      },
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">分期节点</h3>
        {!adding && (
          <Button variant="ghost" onClick={() => setAdding(true)}>
            + 加分期
          </Button>
        )}
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-4">
          <TextField label="名称" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="如 签约首付" />
          <TextField label="应付日期" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <TextField label="金额" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <div className="flex items-end gap-2">
            <Button type="submit" disabled={create.isPending || !(Number(amount) > 0)}>
              添加
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
              取消
            </Button>
          </div>
        </form>
      )}

      {installments.isPending ? (
        <p className="text-sm text-slate-400">加载分期…</p>
      ) : installments.data && installments.data.length > 0 ? (
        <ul className="rounded-lg border border-slate-200 bg-white px-3">
          {installments.data.map((i) => (
            <InstallmentRow key={i.id} planId={planId} inst={i} currency={currency} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-400">暂无分期</p>
      )}
    </div>
  )
}
