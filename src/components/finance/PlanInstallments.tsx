import { useState } from 'react'
import type { FormEvent } from 'react'
import { Pill } from '../ui/Pill'
import { TextField } from '../ui/TextField'
import { Button } from '../ui/Button'
import {
  useInstallments,
  useUpdateInstallment,
  useCreateInstallment,
  useDeleteInstallment,
} from '../../hooks/queries/usePayments'
import { isInstallmentOverdue } from '../../lib/accounting'
import { formatMoney } from '../../lib/money'
import type { Installment } from '../../types/models'

const todayStr = () => new Date().toISOString().slice(0, 10)

/** 单个分期节点状态 → Pill 色调 + 文案。 */
function instStatus(inst: Installment): { tone: 'emerald' | 'amber' | 'rose'; label: string; paid: boolean } {
  if (inst.is_paid) return { tone: 'emerald', label: '已付', paid: true }
  if (isInstallmentOverdue(inst.due_date, inst.is_paid)) return { tone: 'rose', label: '逾期未付', paid: false }
  return { tone: 'amber', label: '待付', paid: false }
}

function InstRow({ planId, inst, index, currency }: { planId: string; inst: Installment; index: number; currency: string }) {
  const update = useUpdateInstallment(planId)
  const del = useDeleteInstallment(planId)
  const st = instStatus(inst)
  const overdue = !inst.is_paid && isInstallmentOverdue(inst.due_date, inst.is_paid)

  const markPaid = (paid: boolean) =>
    update.mutate({ id: inst.id, patch: { is_paid: paid, paid_at: paid ? todayStr() : null } })

  return (
    <tr className="border-t border-line bg-surface-2/60">
      <td className="py-2 pr-3 pl-8">
        <span className="text-[13px] font-semibold text-body">{inst.label || `第 ${index + 1} 期`}</span>
        <span className={`ml-2.5 text-[11.5px] ${overdue ? 'font-medium text-rose-600' : 'text-faint'}`}>
          {inst.due_date ? `到期 ${inst.due_date}` : '无日期'}
        </span>
      </td>
      <td className="px-3 py-2 text-right text-[13px] font-semibold tabular-nums whitespace-nowrap text-ink">
        {formatMoney(inst.amount, currency)}
      </td>
      <td className="px-3 py-2">
        <Pill tone={st.tone} dot={false}>{st.label}</Pill>
      </td>
      <td className="py-2 pl-3 text-right whitespace-nowrap">
        {st.paid ? (
          <span className="inline-flex items-center gap-2">
            <span className="text-emerald-600" title="已收款">✓</span>
            <button type="button" disabled={update.isPending} onClick={() => markPaid(false)} className="text-xs text-faint hover:text-brand">
              撤销
            </button>
          </span>
        ) : (
          <button type="button" disabled={update.isPending} onClick={() => markPaid(true)} className="text-xs font-semibold text-brand hover:underline">
            记收款
          </button>
        )}
        <button
          type="button"
          disabled={del.isPending}
          onClick={() => { if (window.confirm('删除该分期节点？')) del.mutate(inst.id) }}
          className="ml-3 text-xs text-faint hover:text-rose-600"
        >
          删
        </button>
      </td>
    </tr>
  )
}

/** 计划级分期表（到期日 / 状态 / 逾期）。挂在整条 payment_plan 上，缩进于阶段表下方。 */
export function PlanInstallments({ planId, currency = 'AUD' }: { planId: string; currency?: string }) {
  const installments = useInstallments(planId)
  const create = useCreateInstallment(planId)
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [amount, setAmount] = useState('')

  const list = installments.data ?? []

  function handleAdd(e: FormEvent) {
    e.preventDefault()
    create.mutate(
      { payment_plan_id: planId, label: label.trim() || null, due_date: dueDate || null, amount: Number(amount) },
      { onSuccess: () => { setLabel(''); setDueDate(''); setAmount(''); setAdding(false) } },
    )
  }

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[13px] font-bold text-body">分期计划（整条应收的到期节点）</span>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className="text-xs font-semibold text-brand hover:underline">
            + 加分期
          </button>
        )}
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="mb-3 grid grid-cols-1 gap-3 rounded-[14px] border border-brand-100 bg-brand-50/40 p-3 md:grid-cols-4">
          <TextField label="名称" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="如 签约首付" />
          <TextField label="到期日" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <TextField label="金额" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <div className="flex items-end gap-2">
            <Button type="submit" disabled={create.isPending || amount.trim() === ''}>添加</Button>
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>取消</Button>
          </div>
        </form>
      )}

      {installments.isPending ? (
        <p className="py-2 text-sm text-faint">加载分期…</p>
      ) : list.length === 0 ? (
        <p className="py-2 text-sm text-faint">暂无分期节点（点「+ 加分期」按到期日排期）</p>
      ) : (
        <div className="overflow-hidden rounded-[14px] border border-line-2 bg-white">
          <table className="w-full border-collapse text-sm">
            <tbody>
              {list.map((inst, i) => (
                <InstRow key={inst.id} planId={planId} inst={inst} index={i} currency={currency} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
