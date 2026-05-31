import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { PaymentEntryForm } from './PaymentEntryForm'
import type { PaymentEntryValues } from './PaymentEntryForm'
import {
  useDeletePayment,
  useSetPaymentInvoice,
  useUpdatePayment,
} from '../../hooks/queries/usePayments'
import { getDocumentSignedUrl } from '../../api/documents'
import { formatMoney } from '../../lib/money'
import { CUSTOMER_PAYMENT_TEXT_CLASS } from '../../lib/finance'
import { PAYMENT_METHOD_LABELS } from '../../types/domain'
import type { ReceiptItem, CustomerPaymentColor } from '../../lib/finance'

function ReceiptItemRow({ item, color = 'default' }: { item: ReceiptItem; color?: CustomerPaymentColor }) {
  const update = useUpdatePayment(item.caseId)
  const del = useDeletePayment(item.caseId)
  const setInvoice = useSetPaymentInvoice(item.caseId)
  const [editing, setEditing] = useState(false)

  function save(v: PaymentEntryValues) {
    update.mutate(
      {
        id: item.paymentId,
        patch: { amount: v.amount, method: v.method, paid_at: v.paid_at, note: v.note, fee_category: v.fee_category },
      },
      { onSuccess: () => setEditing(false) },
    )
  }

  function onPickInvoice(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // 允许再次选同一文件
    if (!file) return
    setInvoice.mutate({ paymentId: item.paymentId, customerId: item.customerId, file })
  }

  async function viewInvoice() {
    if (!item.invoicePath) return
    try {
      const url = await getDocumentSignedUrl(item.invoicePath)
      window.open(url, '_blank', 'noopener')
    } catch {
      window.alert('打开发票失败，请重试')
    }
  }

  if (editing) {
    return (
      <li className="border-b border-slate-100 py-2.5 last:border-0">
        <PaymentEntryForm
          initial={{ amount: item.amount, method: item.method, paid_at: item.paidAt, note: item.note, fee_category: item.feeCategory }}
          submitLabel="保存修改"
          showFeeCategory
          pending={update.isPending}
          onSubmit={save}
          onCancel={() => setEditing(false)}
        />
      </li>
    )
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-100 py-2.5 last:border-0">
      <Badge className="bg-emerald-100 text-emerald-800">收款</Badge>
      <Link
        to={`/cases/${item.caseId}`}
        state={{ from: 'finance' }}
        className={`text-sm hover:underline ${
          color === 'default' ? 'text-slate-900' : CUSTOMER_PAYMENT_TEXT_CLASS[color]
        }`}
      >
        {item.customerName || '（未知客户）'}
        <span className="text-slate-400"> · {item.visaSubclass}</span>
      </Link>
      {item.caseNumber && (
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] tabular-nums text-slate-600" title="案件编号">
          #{item.caseNumber}
        </span>
      )}
      <span className="flex-1 text-xs text-slate-400">
        {PAYMENT_METHOD_LABELS[item.method]} · {item.paidAt || '无日期'}
        {item.note ? ` · ${item.note}` : ''}
      </span>
      {item.feeCategory && (
        <Badge className="bg-sky-100 text-sky-800">{item.feeCategory}</Badge>
      )}
      <span className="text-sm font-medium tabular-nums text-slate-900">{formatMoney(item.amount)}</span>

      {/* 发票：与该收款所属案件编号绑定 */}
      {item.invoicePath ? (
        <span className="flex items-center gap-1.5">
          <button type="button" onClick={viewInvoice} className="text-xs font-medium text-indigo-600 hover:underline">
            查看发票
          </button>
          <label className="cursor-pointer text-xs text-slate-400 hover:text-indigo-600">
            {setInvoice.isPending ? '上传中…' : '替换'}
            <input type="file" hidden accept="image/*,application/pdf" disabled={setInvoice.isPending} onChange={onPickInvoice} />
          </label>
        </span>
      ) : (
        <label
          className={`cursor-pointer text-xs font-medium ${setInvoice.isPending ? 'text-slate-400' : 'text-indigo-600 hover:underline'}`}
        >
          {setInvoice.isPending ? '上传中…' : '上传发票'}
          <input type="file" hidden accept="image/*,application/pdf" disabled={setInvoice.isPending} onChange={onPickInvoice} />
        </label>
      )}

      <Button variant="ghost" onClick={() => setEditing(true)}>
        编辑
      </Button>
      <Button
        variant="ghost"
        disabled={del.isPending}
        onClick={() => {
          if (window.confirm('删除这笔收款？')) del.mutate(item.paymentId)
        }}
      >
        删除
      </Button>
    </li>
  )
}

export function ReceiptsList({
  items,
  total,
  colorByCase = {},
}: {
  items: ReceiptItem[]
  total: number
  /** caseId → 客户名颜色（按该案应收状态）；缺省 default 不上色 */
  colorByCase?: Record<string, CustomerPaymentColor>
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs text-slate-500">
        已收合计 <span className="font-medium text-emerald-700">{formatMoney(total)}</span>
      </div>
      {items.length === 0 ? (
        <p className="py-2 text-sm text-slate-400">暂无收款记录</p>
      ) : (
        <ul className="rounded-lg border border-slate-200 bg-white px-3">
          {items.map((i) => (
            <ReceiptItemRow key={i.paymentId} item={i} color={colorByCase[i.caseId] ?? 'default'} />
          ))}
        </ul>
      )}
    </div>
  )
}
