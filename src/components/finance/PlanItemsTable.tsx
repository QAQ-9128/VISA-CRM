import { useState } from 'react'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import { TextField } from '../ui/TextField'
import { PaymentEntryForm } from './PaymentEntryForm'
import type { PaymentEntryValues } from './PaymentEntryForm'
import {
  useAllPlanItems,
  useCreatePlanItem,
  useUpdatePlanItem,
  useDeletePlanItem,
  useCreatePayment,
  useCreatePaymentPlan,
  usePaymentsByCase,
} from '../../hooks/queries/usePayments'
import { useCase } from '../../hooks/queries/useCases'
import { getItemPaid, getItemUnpaid, getCaseTotals } from '../../lib/planItems'
import { formatMoney } from '../../lib/money'
import { FEE_CATEGORIES, FEE_CATEGORY_OTHER } from '../../types/domain'

const fmt = (n: number, cur: string) => formatMoney(n, cur)

/** 新增款项行：选费用类别（或手填）+ 输应收。 */
function AddItemForm({ onAdd, onCancel, pending }: { onAdd: (cat: string, amount: number) => void; onCancel: () => void; pending: boolean }) {
  const [cat, setCat] = useState(FEE_CATEGORIES[0] as string)
  const [other, setOther] = useState('')
  const [amount, setAmount] = useState('')
  const resolved = cat === FEE_CATEGORY_OTHER ? other.trim() : cat
  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg border border-indigo-200 bg-indigo-50/40 p-3 md:grid-cols-3">
      <Select
        label="费用类别"
        options={[...FEE_CATEGORIES.map((c) => ({ value: c, label: c })), { value: FEE_CATEGORY_OTHER, label: '其他（手填）' }]}
        value={cat}
        onChange={(e) => setCat(e.target.value)}
      />
      {cat === FEE_CATEGORY_OTHER && (
        <TextField label="其他类别" value={other} onChange={(e) => setOther(e.target.value)} placeholder="如：公证费" />
      )}
      <TextField label="应收（AUD）" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <div className="flex items-end gap-2 md:col-span-3">
        <Button type="button" disabled={pending || resolved === '' || amount.trim() === ''} onClick={() => onAdd(resolved, Number(amount))}>
          {pending ? '保存中…' : '添加款项'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>取消</Button>
      </div>
    </div>
  )
}

/**
 * 款项明细表：一个案件(plan)下多条款项，每条独立 应收/已付/未付。
 * 改应收(inline) / 收款(选 item) / 删除(有收款则禁删)；+ 新增款项；表底案件级汇总。
 * planId 为 null 时表示尚未建付款计划——新增款项会先建 plan 再建款项。
 */
export function PlanItemsTable({
  caseId,
  planId,
  applicantId = null,
  currency = 'AUD',
}: {
  caseId: string
  planId: string | null
  applicantId?: string | null
  currency?: string
}) {
  const allItems = useAllPlanItems()
  const paymentsQ = usePaymentsByCase(caseId)
  const caseQ = useCase(caseId)
  const createItem = useCreatePlanItem()
  const updateItem = useUpdatePlanItem()
  const delItem = useDeletePlanItem()
  const createPayment = useCreatePayment(caseId)
  const createPlan = useCreatePaymentPlan(caseId)

  const items = (allItems.data ?? []).filter((i) => planId && i.plan_id === planId)
  const payments = paymentsQ.data ?? []
  const totals = getCaseTotals(items, payments)

  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<string | null>(null) // 改应收中的款项
  const [editAmount, setEditAmount] = useState('')
  const [payId, setPayId] = useState<string | null>(null) // 正在收款的款项

  async function handleAdd(cat: string, amount: number) {
    let pid = planId
    if (!pid) {
      const plan = await createPlan.mutateAsync({ case_id: caseId, applicant_id: applicantId })
      pid = plan.id
    }
    await createItem.mutateAsync({ plan_id: pid, fee_category: cat, amount_due: amount })
    setAdding(false)
  }

  function saveAmount(id: string) {
    updateItem.mutate(
      { id, patch: { amount_due: Number(editAmount) } },
      { onSuccess: () => setEditId(null) },
    )
  }

  function addPayment(itemId: string, v: PaymentEntryValues) {
    createPayment.mutate(
      {
        case_id: caseId,
        applicant_id: applicantId,
        direction: 'from_client',
        plan_item_id: v.plan_item_id ?? itemId,
        from_client_customer_id: v.from_client_customer_id,
        fee_category: v.fee_category,
        amount: v.amount,
        method: v.method,
        paid_at: v.paid_at,
        note: v.note,
      },
      { onSuccess: () => setPayId(null) },
    )
  }

  const itemOptions = items.map((i) => ({ id: i.id, fee_category: i.fee_category }))

  return (
    <div className="space-y-2">
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <table className="w-full min-w-[30rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-2 pr-3 font-medium">款项</th>
              <th className="py-2 px-3 text-right font-medium">应收</th>
              <th className="py-2 px-3 text-right font-medium">已付</th>
              <th className="py-2 px-3 text-right font-medium">未付</th>
              <th className="py-2 pl-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-3 text-sm text-slate-400">暂无款项，点「+ 新增款项」开始记账</td>
              </tr>
            ) : (
              items.map((it) => {
                const paid = getItemPaid(it.id, payments)
                const unpaid = getItemUnpaid(it, payments)
                return (
                  <tr key={it.id} className="border-b border-slate-100">
                    <td className="py-2.5 pr-3 text-slate-900">{it.fee_category}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-slate-900">
                      {editId === it.id ? (
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm tabular-nums outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                        />
                      ) : (
                        fmt(Number(it.amount_due), currency)
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-emerald-700">{fmt(paid, currency)}</td>
                    <td className={`py-2.5 px-3 text-right font-medium tabular-nums ${unpaid > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                      {fmt(Math.max(0, unpaid), currency)}
                    </td>
                    <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                      {editId === it.id ? (
                        <>
                          <Button type="button" onClick={() => saveAmount(it.id)} disabled={updateItem.isPending}>保存</Button>
                          <Button type="button" variant="ghost" onClick={() => setEditId(null)}>取消</Button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="text-xs font-medium text-indigo-600 hover:underline"
                            onClick={() => {
                              setEditId(it.id)
                              setEditAmount(String(it.amount_due))
                            }}
                          >
                            改应收
                          </button>
                          <button
                            type="button"
                            className="ml-3 text-xs font-medium text-emerald-700 hover:underline"
                            onClick={() => setPayId(payId === it.id ? null : it.id)}
                          >
                            收款
                          </button>
                          <button
                            type="button"
                            className="ml-3 text-xs font-medium text-slate-400 hover:text-rose-600"
                            onClick={() => delItem.mutate({ id: it.id, payments })}
                            disabled={delItem.isPending}
                          >
                            删除
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 font-semibold text-slate-900">
              <td className="py-2.5 pr-3">合计</td>
              <td className="py-2.5 px-3 text-right tabular-nums">{fmt(totals.totalDue, currency)}</td>
              <td className="py-2.5 px-3 text-right tabular-nums text-emerald-700">{fmt(totals.totalPaid, currency)}</td>
              <td className="py-2.5 px-3 text-right tabular-nums text-rose-600">{fmt(Math.max(0, totals.totalUnpaid), currency)}</td>
              <td className="py-2.5 pl-3"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {delItem.isError && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {delItem.error instanceof Error ? delItem.error.message : '删除失败'}
        </p>
      )}

      {payId && (
        <PaymentEntryForm
          items={itemOptions}
          initialItemId={payId}
          submitLabel="收款"
          showPayer
          defaultPayerCustomerId={caseQ.data?.customer_id}
          pending={createPayment.isPending}
          onSubmit={(v) => addPayment(payId, v)}
          onCancel={() => setPayId(null)}
        />
      )}

      {adding ? (
        <AddItemForm onAdd={handleAdd} onCancel={() => setAdding(false)} pending={createItem.isPending || createPlan.isPending} />
      ) : (
        <Button type="button" variant="secondary" onClick={() => setAdding(true)}>+ 新增款项</Button>
      )}
    </div>
  )
}
