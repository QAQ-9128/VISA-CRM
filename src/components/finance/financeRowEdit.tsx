import { useEffect, useRef, useState } from 'react'
import { ReceivablesItemsArea } from './ReceivablesItemsArea'
import { PlanInstallments } from './PlanInstallments'
import { PaymentEntryForm } from './PaymentEntryForm'
import type { PaymentEntryValues } from './PaymentEntryForm'
import { useCreatePayment } from '../../hooks/queries/usePayments'
import type { ReceivableRow } from '../../lib/finance'

/** 行内编辑模式：分阶段/应收编辑器 或 案件级支出表单。 */
export type RowMode = null | 'receivables' | 'expense-company' | 'expense-referrer'

/** 记账▾ 下拉：记应收 / 记收款 / 创建付款计划 / 付主代理 / 付介绍人。前三项打开应收编辑器，后两项打开支出表单。 */
export function RecMenu({ onPick }: { onPick: (mode: Exclude<RowMode, null>) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const items: { label: string; mode: Exclude<RowMode, null> }[] = [
    { label: '记应收', mode: 'receivables' },
    { label: '记收款', mode: 'receivables' },
    { label: '创建付款计划', mode: 'receivables' },
    { label: '付主代理', mode: 'expense-company' },
    { label: '付介绍人', mode: 'expense-referrer' },
  ]

  return (
    <span ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-md px-2 py-1.5 text-xs font-semibold text-brand hover:bg-brand-50"
      >
        记账 ▾
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-30 min-w-32 rounded-xl border border-line-2 bg-white p-1.5 shadow-soft">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              onClick={() => { setOpen(false); onPick(it.mode) }}
              className="block w-full rounded-lg px-3 py-2 text-left text-[13.5px] font-medium whitespace-nowrap text-body hover:bg-surface-2"
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </span>
  )
}

/** 按案件直接加支出（付主代理 / 付介绍人）：复用 PaymentEntryForm + useCreatePayment，方向固定。 */
function CaseExpenseForm({
  caseId,
  direction,
  onDone,
}: {
  caseId: string
  direction: 'to_company' | 'to_referrer'
  onDone: () => void
}) {
  const createPayment = useCreatePayment(caseId)
  const title = direction === 'to_company' ? '付主代理' : '付介绍人'
  function submit(v: PaymentEntryValues) {
    createPayment.mutate(
      { case_id: caseId, direction, amount: v.amount, method: v.method, paid_at: v.paid_at, note: v.note },
      { onSuccess: onDone },
    )
  }
  return (
    <div className="space-y-2 rounded-[14px] border border-brand-100 bg-brand-50/40 p-3">
      <p className="text-[13px] font-semibold text-body">{title}</p>
      <PaymentEntryForm submitLabel={title} pending={createPayment.isPending} onSubmit={submit} onCancel={onDone} />
    </div>
  )
}

/** 分阶段展开主体：分阶段收费编辑器（含新增阶段）+ 计划级分期表。 */
export function StageExpandArea({ row }: { row: ReceivableRow }) {
  return (
    <>
      <ReceivablesItemsArea caseId={row.caseId} planId={row.planId} applicantId={row.applicantId} staged={row.staged} />
      {row.planId && <PlanInstallments planId={row.planId} />}
    </>
  )
}

/** 记账▾ 选中的编辑器主体。 */
export function RowModeArea({ row, mode, onClose }: { row: ReceivableRow; mode: Exclude<RowMode, null>; onClose: () => void }) {
  if (mode === 'receivables') {
    return <ReceivablesItemsArea caseId={row.caseId} planId={row.planId} applicantId={row.applicantId} staged={row.staged} />
  }
  return (
    <CaseExpenseForm caseId={row.caseId} direction={mode === 'expense-company' ? 'to_company' : 'to_referrer'} onDone={onClose} />
  )
}
