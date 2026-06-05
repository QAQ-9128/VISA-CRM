import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { Select } from '../ui/Select'
import { useCustomers } from '../../hooks/queries/useCustomers'
import { FEE_CATEGORIES, FEE_CATEGORY_OTHER, PAYMENT_METHOD_LABELS } from '../../types/domain'
import type { PaymentMethod } from '../../types/domain'

/** 财务录入的方式：现金 / 转账 / 垫付（其他历史方式在编辑时按需保留）。 */
const FINANCE_METHODS: PaymentMethod[] = ['cash', 'transfer', 'advance']
import { todayYmd } from '../../lib/dateRules'

// 录款默认日期取本地日历日——toISOString 是 UTC 日，本地清晨会落到昨天甚至上个月，污染月度账目
const todayStr = todayYmd

const FEE_CATEGORY_LIST: readonly string[] = FEE_CATEGORIES

export interface PaymentEntryValues {
  amount: number
  method: PaymentMethod
  paid_at: string | null
  note: string | null
  fee_category: string | null
  /** 归属的款项明细 id（items 模式下有值；否则 null = 未归类） */
  plan_item_id: string | null
  /** 实际付款方客户 id（showPayer 时可选；空 = 回落案件客户） */
  from_client_customer_id: string | null
}

interface Props {
  initial?: {
    amount?: number | string | null
    method?: PaymentMethod
    paid_at?: string | null
    note?: string | null
    fee_category?: string | null
    from_client_customer_id?: string | null
  }
  submitLabel?: string
  pending?: boolean
  /** 是否显示「费用类别」下拉（仅客户收款 from_client 用；支出/付款留默认 false）。 */
  showFeeCategory?: boolean
  /** 是否显示「付款方」下拉（仅客户收款 from_client 用）。 */
  showPayer?: boolean
  /** 「付款方」默认项指向的客户（案件客户）id，用于占位文案；空 = 「案件客户」。 */
  defaultPayerCustomerId?: string
  /** 提供则显示「针对哪条款项」下拉（取代费用类别）；fee_category 自动 = 选中款项的类别。 */
  items?: { id: string; fee_category: string }[]
  initialItemId?: string
  onSubmit: (v: PaymentEntryValues) => void
  onCancel: () => void
}

export function PaymentEntryForm({
  initial,
  submitLabel = '保存',
  pending,
  showFeeCategory = false,
  showPayer = false,
  defaultPayerCustomerId,
  items,
  initialItemId,
  onSubmit,
  onCancel,
}: Props) {
  const [amount, setAmount] = useState(initial?.amount != null ? String(initial.amount) : '')
  const [method, setMethod] = useState<PaymentMethod>(initial?.method ?? 'transfer')
  const [paidAt, setPaidAt] = useState(initial?.paid_at ?? todayStr())
  const [note, setNote] = useState(initial?.note ?? '')
  const [payerId, setPayerId] = useState(initial?.from_client_customer_id ?? '')
  // 付款方候选：全部在册客户（可选家庭组成员/任意客户）。仅 showPayer 时用。
  const allCustomers = useCustomers({})
  const customerList = allCustomers.data ?? []
  const defaultPayerName =
    customerList.find((c) => c.id === defaultPayerCustomerId)?.full_name ?? '案件客户'
  const itemMode = !!items && items.length > 0
  const [itemId, setItemId] = useState(initialItemId ?? (items?.[0]?.id ?? ''))
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
    if (itemMode) return items!.find((i) => i.id === itemId)?.fee_category ?? null
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
      plan_item_id: itemMode ? itemId || null : null,
      from_client_customer_id: showPayer ? payerId || null : initial?.from_client_customer_id ?? null,
    })
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3 md:grid-cols-2">
      {itemMode && (
        <Select
          label="针对哪条款项"
          options={items!.map((i) => ({ value: i.id, label: i.fee_category }))}
          value={itemId}
          onChange={(e) => setItemId(e.target.value)}
          className="md:col-span-2"
        />
      )}
      {showPayer && (
        <Select
          label="付款方"
          placeholder={`（默认：${defaultPayerName}）`}
          options={customerList.map((c) => ({ value: c.id, label: c.full_name }))}
          value={payerId}
          onChange={(e) => setPayerId(e.target.value)}
          className="md:col-span-2"
        />
      )}
      <TextField label="金额（AUD）" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <Select label="方式" options={methodOptions} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} />
      <TextField label="日期" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
      <TextField label="备注" value={note} onChange={(e) => setNote(e.target.value)} placeholder="可选" />
      {showFeeCategory && !itemMode && (
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
