import { useMemo, useState } from 'react'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import { PaymentEntryForm } from './PaymentEntryForm'
import type { PaymentEntryValues } from './PaymentEntryForm'
import { useAllPlanItems, useCreatePayment } from '../../hooks/queries/usePayments'
import { formatVisaType } from '../../lib/visa'
import type { ReceivableRow } from '../../lib/finance'

const rowKey = (r: ReceivableRow) => `${r.caseId}:${r.applicantId ?? 'merged'}`
const ROLE = { merged: '', primary: '· 主申', secondary: '· 副申' } as const

/**
 * 月度账目「+ 记收款」：选一条应收单元 → 复用现有 PaymentEntryForm（items 模式，带 plan_item_id/费用类别/付款方）
 * + useCreatePayment 记一笔 from_client 收款。不新建收款逻辑；记完已付/未付/分期由现有失效逻辑自动刷新。
 * 只列已设应收(receivable>0)的单元——有账可收。
 */
export function RecordReceiptForm({ rows, onDone }: { rows: ReceivableRow[]; onDone: () => void }) {
  const billable = useMemo(() => rows.filter((r) => r.receivable > 0), [rows])
  const [sel, setSel] = useState('')
  const row = billable.find((r) => rowKey(r) === sel)
  const planId = row?.planId ?? null
  const allItems = useAllPlanItems()
  const createPayment = useCreatePayment(row?.caseId ?? '')

  const items = useMemo(
    () =>
      planId
        ? (allItems.data ?? []).filter((i) => i.plan_id === planId).map((i) => ({ id: i.id, fee_category: i.fee_category }))
        : [],
    [allItems.data, planId],
  )

  const options = billable.map((r) => ({
    value: rowKey(r),
    label: `${r.customerName || '未命名'} · ${formatVisaType(r.visaSubclass)} ${ROLE[r.role]}`.trim(),
  }))

  function submit(v: PaymentEntryValues) {
    if (!row) return
    createPayment.mutate(
      {
        case_id: row.caseId,
        applicant_id: row.applicantId,
        direction: 'from_client',
        plan_item_id: v.plan_item_id,
        from_client_customer_id: v.from_client_customer_id,
        fee_category: v.fee_category,
        amount: v.amount,
        method: v.method,
        paid_at: v.paid_at,
        note: v.note,
      },
      { onSuccess: onDone },
    )
  }

  return (
    <div className="space-y-3 rounded-[14px] border border-brand-100 bg-brand-50/40 p-3">
      <p className="text-[13px] font-semibold text-body">记收款</p>
      {billable.length === 0 ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-faint">暂无已设应收的案件，请先到「近期案件应收」记应收/创建付款计划。</p>
          <Button type="button" variant="ghost" onClick={onDone}>取消</Button>
        </div>
      ) : (
        <>
          <Select
            label="案件（客户 · 签证）"
            placeholder="选择案件"
            options={options}
            value={sel}
            onChange={(e) => setSel(e.target.value)}
          />
          {row ? (
            <PaymentEntryForm
              items={items}
              showPayer
              defaultPayerCustomerId={row.customerId}
              submitLabel="记收款"
              pending={createPayment.isPending}
              onSubmit={submit}
              onCancel={onDone}
            />
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-xs text-faint">请先选择案件</p>
              <Button type="button" variant="ghost" onClick={onDone}>取消</Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
