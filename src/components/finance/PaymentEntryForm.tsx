import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { Select } from '../ui/Select'
import { FEE_CATEGORIES, FEE_CATEGORY_OTHER, PAYMENT_METHOD_LABELS } from '../../types/domain'
import type { PaymentMethod } from '../../types/domain'

/** 财务录入的方式：现金 / 转账 / 垫付（其他历史方式在编辑时按需保留）。 */
const FINANCE_METHODS: PaymentMethod[] = ['cash', 'transfer', 'advance']
const todayStr = () => new Date().toISOString().slice(0, 10)

const FEE_CATEGORY_LIST: readonly string[] = FEE_CATEGORIES

export interface PaymentEntryValues {
  amount: number
  method: PaymentMethod
  paid_at: string | null
  note: string | null
  fee_category: string | null
}

interface Props {
  initial?: {
    amount?: number | string | null
    method?: PaymentMethod
    paid_at?: string | null
    note?: string | null
    fee_category?: string | null
  }
  submitLabel?: string
  pending?: boolean
  /** 是否显示「费用类别」下拉（仅客户收款 from_client 用；支出/付款留默认 false）。 */
  showFeeCategory?: boolean
  onSubmit: (v: PaymentEntryValues) => void
  onCancel: () => void
}

export function PaymentEntryForm({
  initial,
  submitLabel = '保存',
  pending,
  showFeeCategory = false,
  onSubmit,
  onCancel,
}: Props) {
  const [amount, setAmount] = useState(initial?.amount != null ? String(initial.amount) : '')
  const [method, setMethod] = useState<PaymentMethod>(initial?.method ?? 'transfer')
  const [paidAt, setPaidAt] = useState(initial?.paid_at ?? todayStr())
  const [note, setNote] = useState(initial?.note ?? '')
  // 已有类别：命中预设 → 选中预设；非空但非预设 → 选「其他」并把原值放进手填框；空 → 未分类。
  const initialFee = initial?.fee_category ?? ''
  const initialIsPreset = initialFee !== '' && FEE_CATEGORY_LIST.includes(initialFee)
  const [feeSelect, setFeeSelect] = useState(
    initialFee === '' ? '' : initialIsPreset ? initialFee : FEE_CATEGORY_OTHER,
  )
  const [feeOther, setFeeOther] = useState(initialIsPreset ? '' : initialFee)

  // 编辑历史记录时，若其方式不在「现金/转账/垫付」内，补进下拉以便正确显示。
  const methods = FINANCE_METHODS.includes(method) ? FINANCE_METHODS : [method, ...FINANCE_METHODS]
  const methodOptions = methods.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))
  const feeOptions = [
    ...FEE_CATEGORIES.map((c) => ({ value: c, label: c })),
    { value: FEE_CATEGORY_OTHER, label: '其他（手填）' },
  ]

  function resolveFeeCategory(): string | null {
    if (!showFeeCategory || feeSelect === '') return null
    if (feeSelect === FEE_CATEGORY_OTHER) return feeOther.trim() || null
    return feeSelect
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    onSubmit({
      amount: Number(amount),
      method,
      paid_at: paidAt || null,
      note: note.trim() || null,
      fee_category: resolveFeeCategory(),
    })
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3 md:grid-cols-2">
      <TextField label="金额（AUD）" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <Select label="方式" options={methodOptions} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} />
      <TextField label="日期" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
      <TextField label="备注" value={note} onChange={(e) => setNote(e.target.value)} placeholder="可选" />
      {showFeeCategory && (
        <>
          <Select
            label="费用类别"
            placeholder="未分类"
            options={feeOptions}
            value={feeSelect}
            onChange={(e) => setFeeSelect(e.target.value)}
          />
          {feeSelect === FEE_CATEGORY_OTHER && (
            <TextField
              label="其他类别（手填）"
              value={feeOther}
              onChange={(e) => setFeeOther(e.target.value)}
              placeholder="如：翻译费、服务费"
            />
          )}
        </>
      )}
      <div className="flex items-end gap-2 md:col-span-2">
        <Button type="submit" disabled={pending || amount.trim() === ''}>
          {pending ? '保存中…' : submitLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          取消
        </Button>
      </div>
    </form>
  )
}
