import { useState } from 'react'
import { Button } from '../ui/Button'
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
import { getItemPaid, getItemUnpaid, getCaseTotals } from '../../lib/planItems'
import { stageUnitAmount, buildStagePayload, validateStage } from '../../lib/staged'
import { formatMoney } from '../../lib/money'

const fmt = (n: number, cur: string) => formatMoney(n, cur)

/** 新增阶段：阶段名(手写) + 应收金额(每期) + 期数；实时预览总计 = 应收×期数。 */
function AddStageForm({ onAdd, onCancel, pending }: { onAdd: (name: string, unit: number, periods: number) => void; onCancel: () => void; pending: boolean }) {
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('')
  const [periods, setPeriods] = useState('1')
  const u = Number(unit) || 0
  const p = Math.max(1, Number(periods) || 1)
  const err = validateStage({ stageName: name, unitAmount: u, periods: p })
  return (
    <div className="space-y-3 rounded-lg border border-indigo-200 bg-indigo-50/40 p-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <TextField label="阶段名" value={name} onChange={(e) => setName(e.target.value)} placeholder="如 意向金 / 递交签证" />
        <TextField label="应收金额（每期）" type="number" min={0} step="0.01" value={unit} onChange={(e) => setUnit(e.target.value)} />
        <TextField label="期数" type="number" min={1} step="1" value={periods} onChange={(e) => setPeriods(e.target.value)} />
      </div>
      <p className="text-sm text-slate-500">总计 = 应收 × 期数 = <span className="font-medium text-slate-900">{u * p}</span></p>
      <div className="flex gap-2">
        <Button type="button" disabled={pending || !!err} onClick={() => onAdd(name, u, p)}>
          {pending ? '保存中…' : '添加阶段'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>取消</Button>
      </div>
    </div>
  )
}

/**
 * 分阶段收费阶段表：一个案件(plan)下多条阶段，每条 应收金额×期数=总计，独立 已付/未付/记账。
 * 阶段名复用 fee_category；总计写 amount_due，故已付/未付/欠款聚合全部沿用现有逻辑。
 * 「记账(收款)」直接复用 PaymentEntryForm + useCreatePayment，不改记账。planId 为 null 时新增阶段会先建 plan。
 */
export function StagedBillingTable({
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
  const createItem = useCreatePlanItem()
  const updateItem = useUpdatePlanItem()
  const delItem = useDeletePlanItem()
  const createPayment = useCreatePayment(caseId)
  const createPlan = useCreatePaymentPlan(caseId)

  const items = (allItems.data ?? []).filter((i) => planId && i.plan_id === planId)
  const payments = paymentsQ.data ?? []
  const totals = getCaseTotals(items, payments)

  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [eName, setEName] = useState('')
  const [eUnit, setEUnit] = useState('')
  const [ePeriods, setEPeriods] = useState('1')
  const [payId, setPayId] = useState<string | null>(null)

  async function handleAdd(name: string, unit: number, periods: number) {
    let pid = planId
    if (!pid) {
      const plan = await createPlan.mutateAsync({ case_id: caseId, applicant_id: applicantId, staged_billing: true })
      pid = plan.id
    }
    await createItem.mutateAsync({ plan_id: pid, ...buildStagePayload({ stageName: name, unitAmount: unit, periods }) })
    setAdding(false)
  }

  function saveEdit(id: string) {
    const u = Number(eUnit) || 0
    const p = Math.max(1, Number(ePeriods) || 1)
    if (validateStage({ stageName: eName, unitAmount: u, periods: p })) return
    updateItem.mutate(
      { id, patch: buildStagePayload({ stageName: eName, unitAmount: u, periods: p }) },
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
        <table className="w-full min-w-[40rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-2 pr-3 font-medium">阶段名</th>
              <th className="py-2 px-3 text-right font-medium">应收金额</th>
              <th className="py-2 px-3 text-right font-medium">期数</th>
              <th className="py-2 px-3 text-right font-medium">总计</th>
              <th className="py-2 px-3 text-right font-medium">已付</th>
              <th className="py-2 px-3 text-right font-medium">未付</th>
              <th className="py-2 pl-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-3 text-sm text-slate-400">暂无阶段，点「+ 新增阶段」开始（如 意向金 / 递交签证）</td>
              </tr>
            ) : (
              items.map((it) => {
                const paid = getItemPaid(it.id, payments)
                const unpaid = getItemUnpaid(it, payments)
                const editing = editId === it.id
                return (
                  <tr key={it.id} className="border-b border-slate-100 align-top">
                    {editing ? (
                      <>
                        <td className="py-2 pr-3"><input className="w-32 rounded-lg border border-slate-300 px-2 py-1 text-sm" value={eName} onChange={(e) => setEName(e.target.value)} /></td>
                        <td className="py-2 px-3 text-right"><input type="number" min={0} step="0.01" className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm tabular-nums" value={eUnit} onChange={(e) => setEUnit(e.target.value)} /></td>
                        <td className="py-2 px-3 text-right"><input type="number" min={1} step="1" className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm tabular-nums" value={ePeriods} onChange={(e) => setEPeriods(e.target.value)} /></td>
                        <td className="py-2 px-3 text-right tabular-nums text-slate-900">{fmt((Number(eUnit) || 0) * Math.max(1, Number(ePeriods) || 1), currency)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-emerald-700">{fmt(paid, currency)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-slate-400">—</td>
                        <td className="py-2 pl-3 text-right whitespace-nowrap">
                          <Button type="button" onClick={() => saveEdit(it.id)} disabled={updateItem.isPending}>保存</Button>
                          <Button type="button" variant="ghost" onClick={() => setEditId(null)}>取消</Button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-2.5 pr-3 text-slate-900">{it.fee_category}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-slate-900">{fmt(stageUnitAmount(it), currency)}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-slate-700">{it.periods}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums font-medium text-slate-900">{fmt(Number(it.amount_due), currency)}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-emerald-700">{fmt(paid, currency)}</td>
                        <td className={`py-2.5 px-3 text-right font-medium tabular-nums ${unpaid > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{fmt(Math.max(0, unpaid), currency)}</td>
                        <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                          <button type="button" className="text-xs font-medium text-indigo-600 hover:underline" onClick={() => { setEditId(it.id); setEName(it.fee_category); setEUnit(String(stageUnitAmount(it))); setEPeriods(String(it.periods)) }}>改</button>
                          <button type="button" className="ml-3 text-xs font-medium text-emerald-700 hover:underline" onClick={() => setPayId(payId === it.id ? null : it.id)}>记账</button>
                          <button type="button" className="ml-3 text-xs font-medium text-slate-400 hover:text-rose-600" onClick={() => delItem.mutate({ id: it.id, payments })} disabled={delItem.isPending}>删除</button>
                        </td>
                      </>
                    )}
                  </tr>
                )
              })
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 font-semibold text-slate-900">
              <td className="py-2.5 pr-3" colSpan={3}>合计</td>
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
          submitLabel="记账"
          pending={createPayment.isPending}
          onSubmit={(v) => addPayment(payId, v)}
          onCancel={() => setPayId(null)}
        />
      )}

      {adding ? (
        <AddStageForm onAdd={handleAdd} onCancel={() => setAdding(false)} pending={createItem.isPending || createPlan.isPending} />
      ) : (
        <Button type="button" variant="secondary" onClick={() => setAdding(true)}>+ 新增阶段</Button>
      )}
    </div>
  )
}
