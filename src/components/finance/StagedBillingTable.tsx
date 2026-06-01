import { useState } from 'react'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { PaymentEntryForm } from './PaymentEntryForm'
import type { PaymentEntryValues } from './PaymentEntryForm'
import { ProgressBar, StatusChip, PaidFraction } from './receivableCells'
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
import { getCaseTotals } from '../../lib/planItems'
import { stageUnitAmount, buildStagePayload, validateStage, stageDisplay } from '../../lib/staged'

/** 阶段编辑/新增表单：阶段名 / 应收金额(每期) / 期数 + 自动总计。新增与「改」共用。 */
function StageFormPanel({
  initial,
  onSave,
  onCancel,
  pending,
}: {
  initial?: { name: string; unit: number; periods: number }
  onSave: (name: string, unit: number, periods: number) => void
  onCancel: () => void
  pending: boolean
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [unit, setUnit] = useState(initial ? String(initial.unit) : '')
  const [periods, setPeriods] = useState(initial ? String(initial.periods) : '1')
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
        <Button type="button" disabled={pending || !!err} onClick={() => onSave(name, u, p)}>
          {pending ? '保存中…' : '保存'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>取消</Button>
      </div>
    </div>
  )
}

/**
 * 分阶段收费阶段表（紧凑版，与「近期案件」行同套列）：
 *   阶段名(+分N期+每期·期数小行) | 已付/应收(分数+进度条) | 未付/状态 | 操作(记账 + ⋯改/删)
 * 单处「合计」= Σ各阶段。阶段名复用 fee_category；总计=应收×期数 写 amount_due，已付/未付/记账沿用现有逻辑。
 * 「记账」直接复用 PaymentEntryForm + useCreatePayment（记账不改）。planId 为 null 时新增阶段先建 plan。
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
  const [editId, setEditId] = useState<string | null>(null)
  const [payId, setPayId] = useState<string | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)

  async function handleAdd(name: string, unit: number, periods: number) {
    let pid = planId
    if (!pid) {
      const plan = await createPlan.mutateAsync({ case_id: caseId, applicant_id: applicantId, staged_billing: true })
      pid = plan.id
    }
    await createItem.mutateAsync({ plan_id: pid, ...buildStagePayload({ stageName: name, unitAmount: unit, periods }) })
    setAdding(false)
  }

  function handleEdit(id: string, name: string, unit: number, periods: number) {
    updateItem.mutate(
      { id, patch: buildStagePayload({ stageName: name, unitAmount: unit, periods }) },
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
        <table className="w-full min-w-[32rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-2 pr-3 font-medium">阶段名</th>
              <th className="py-2 px-3 text-right font-medium">已付 / 应收</th>
              <th className="py-2 px-3 text-right font-medium">未付 / 状态</th>
              <th className="py-2 pl-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-3 text-sm text-slate-400">暂无阶段，点「+ 新增阶段」开始（如 意向金 / 递交签证）</td>
              </tr>
            ) : (
              items.map((it) => {
                if (editId === it.id) {
                  return (
                    <tr key={it.id} className="border-b border-slate-100">
                      <td colSpan={4} className="py-2">
                        <StageFormPanel
                          initial={{ name: it.fee_category, unit: stageUnitAmount(it), periods: it.periods }}
                          onSave={(n, u, p) => handleEdit(it.id, n, u, p)}
                          onCancel={() => setEditId(null)}
                          pending={updateItem.isPending}
                        />
                      </td>
                    </tr>
                  )
                }
                const d = stageDisplay(it, payments, currency)
                return (
                  <tr key={it.id} className="border-b border-slate-100">
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-900">{d.name}</span>
                        {d.showPeriodsTag && (
                          <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600">分 {d.periods} 期</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">{d.unitLine}</p>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <PaidFraction paid={d.paid} receivable={d.receivable} />
                      <ProgressBar paid={d.paid} receivable={d.receivable} />
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <StatusChip receivable={d.receivable} unpaid={d.unpaid} />
                    </td>
                    <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        className="text-xs font-medium text-emerald-700 hover:underline"
                        onClick={() => { setMenuId(null); setPayId(payId === it.id ? null : it.id) }}
                      >
                        记账
                      </button>
                      <div className="relative ml-2 inline-block">
                        <button
                          type="button"
                          aria-label="更多操作"
                          className="rounded px-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          onClick={() => setMenuId(menuId === it.id ? null : it.id)}
                        >
                          ⋯
                        </button>
                        {menuId === it.id && (
                          <div className="absolute right-0 z-10 mt-1 w-20 rounded-lg border border-slate-200 bg-white py-1 text-left shadow-md">
                            <button
                              type="button"
                              className="block w-full px-3 py-1 text-left text-xs text-slate-700 hover:bg-slate-50"
                              onClick={() => { setMenuId(null); setPayId(null); setEditId(it.id) }}
                            >
                              改
                            </button>
                            <button
                              type="button"
                              className="block w-full px-3 py-1 text-left text-xs text-rose-600 hover:bg-rose-50"
                              onClick={() => { setMenuId(null); delItem.mutate({ id: it.id, payments }) }}
                            >
                              删除
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 font-semibold text-slate-900">
              <td className="py-2.5 pr-3">合计</td>
              <td className="py-2.5 px-3 text-right">
                <PaidFraction paid={totals.totalPaid} receivable={totals.totalDue} />
              </td>
              <td className="py-2.5 px-3 text-right">
                <StatusChip receivable={totals.totalDue} unpaid={Math.max(0, totals.totalUnpaid)} />
              </td>
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
          showPayer
          defaultPayerCustomerId={caseQ.data?.customer_id}
          pending={createPayment.isPending}
          onSubmit={(v) => addPayment(payId, v)}
          onCancel={() => setPayId(null)}
        />
      )}

      {adding ? (
        <StageFormPanel onSave={handleAdd} onCancel={() => setAdding(false)} pending={createItem.isPending || createPlan.isPending} />
      ) : (
        <Button type="button" variant="secondary" onClick={() => setAdding(true)}>+ 新增阶段</Button>
      )}
    </div>
  )
}
