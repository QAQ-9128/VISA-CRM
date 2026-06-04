import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { Select } from '../ui/Select'
import { Card, CardHead } from '../ui/Card'
import { useCreatePayment } from '../../hooks/queries/usePayments'
import { useCustomers } from '../../hooks/queries/useCustomers'
import { PAYMENT_METHOD_LABELS } from '../../types/domain'
import type { PaymentMethod } from '../../types/domain'
import type { Installment, PaymentPlanItem } from '../../types/models'

/** 收款方式：与现有「记收款」一致（现金 / 转账 / 垫付）。 */
const RECEIPT_METHODS: PaymentMethod[] = ['cash', 'transfer', 'advance']
const todayStr = () => new Date().toISOString().slice(0, 10)

/**
 * 「记一笔收款」卡（案件付款 tab 右栏）。
 * 表单字段都映射到真实列；提交复用现有 useCreatePayment（→ createPayment → 失效 byCase + dashboard 聚合），
 * 已收 / 未收 / 状态 / 付款方(#5 from_client_customer_id) 全部按现有逻辑刷新——不新建一套账目逻辑。
 */
export function RecordPaymentForm({
  caseId,
  items,
  installments,
  currency = 'AUD',
  defaultPayerCustomerId,
  applicantId = null,
}: {
  caseId: string
  items: Pick<PaymentPlanItem, 'id' | 'fee_category'>[]
  installments: Pick<Installment, 'id' | 'label' | 'due_date'>[]
  currency?: string
  /** 案件主申 id：作为「付款方」默认占位（空 = 主申请） */
  defaultPayerCustomerId?: string
  /** 账单归属客户：把这笔收款记到本案该客户名下（applicant_id）。null = 合并/未分人 */
  applicantId?: string | null
}) {
  const create = useCreatePayment(caseId)
  const allCustomers = useCustomers({})
  const customerList = allCustomers.data ?? []
  const defaultPayerName =
    customerList.find((c) => c.id === defaultPayerCustomerId)?.full_name ?? '主申请'

  const [itemId, setItemId] = useState('')
  const [installmentId, setInstallmentId] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('transfer')
  const [paidAt, setPaidAt] = useState(todayStr())
  const [payerId, setPayerId] = useState('')
  const [done, setDone] = useState(false)

  const hasItems = items.length > 0
  const canSubmit = hasItems && itemId !== '' && amount.trim() !== '' && Number(amount) > 0

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    const fee = items.find((i) => i.id === itemId)?.fee_category ?? null
    create.mutate(
      {
        case_id: caseId,
        applicant_id: applicantId,
        direction: 'from_client',
        plan_item_id: itemId || null,
        installment_id: installmentId || null,
        from_client_customer_id: payerId || null,
        amount: Number(amount),
        currency,
        method,
        paid_at: paidAt || null,
        fee_category: fee,
      },
      {
        onSuccess: () => {
          setAmount('')
          setInstallmentId('')
          setPayerId('')
          setDone(true)
          setTimeout(() => setDone(false), 2500)
        },
      },
    )
  }

  return (
    <Card>
      <CardHead title="记一笔收款" />
      {!hasItems ? (
        <p className="text-sm text-faint">请先在「收费项目」中添加款项，再记录收款。</p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <Select
            label="对应款项 *"
            options={items.map((i) => ({ value: i.id, label: i.fee_category }))}
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            placeholder="选择款项"
          />
          {installments.length > 0 && (
            <Select
              label="对应分期（可选）"
              placeholder="不挂分期"
              options={installments.map((i) => ({
                value: i.id,
                label: i.label || (i.due_date ? `到期 ${i.due_date}` : '分期'),
              }))}
              value={installmentId}
              onChange={(e) => setInstallmentId(e.target.value)}
            />
          )}
          <TextField
            label={`收款金额（${currency}）*`}
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Select
            label="收款方式 *"
            options={RECEIPT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))}
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
          />
          <TextField label="收款日期 *" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          <Select
            label="付款方（可选）"
            placeholder={`默认：${defaultPayerName}`}
            options={customerList.map((c) => ({ value: c.id, label: c.full_name }))}
            value={payerId}
            onChange={(e) => setPayerId(e.target.value)}
          />
          {create.isError && <p className="text-sm text-rose-600">保存失败，请重试。</p>}
          <div className="flex items-center gap-2 pt-0.5">
            <Button type="submit" disabled={!canSubmit || create.isPending}>
              {create.isPending ? '保存中…' : '确认收款'}
            </Button>
            {done && <span className="text-sm text-emerald-600">已记录 ✓</span>}
          </div>
        </form>
      )}
    </Card>
  )
}
