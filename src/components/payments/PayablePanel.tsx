import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { Select } from '../ui/Select'
import { PaymentPlanForm } from './PaymentPlanForm'
import { useCreatePayment } from '../../hooks/queries/usePayments'
import { formatMoney } from '../../lib/money'
import { errorMessage } from '../../lib/errorMessage'
import { payableStatus } from '../../lib/accounting'
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '../../types/domain'
import type { PaymentDirection, PaymentMethod } from '../../types/domain'
import type { Accounting } from '../../lib/accounting'
import type { PaymentPlan } from '../../types/models'

import { todayYmd } from '../../lib/dateRules'

// 录款默认日期取本地日历日——toISOString 是 UTC 日，本地清晨会落到昨天甚至上个月，污染月度账目
const todayStr = todayYmd

/** 记一笔付款（付主代理 / 付介绍人）——复用 useCreatePayment，方向固定，不新建账目逻辑。 */
export function QuickPayoutForm({
  caseId,
  direction,
  currency,
  onDone,
  applicantId = null,
}: {
  caseId: string
  direction: PaymentDirection
  currency: string
  onDone: () => void
  /** 账单归属客户：把这笔付款记到本案该客户名下（applicant_id）。null = 合并/未分人 */
  applicantId?: string | null
}) {
  const create = useCreatePayment(caseId)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('transfer')
  const [paidAt, setPaidAt] = useState(todayStr())
  const errMsg = errorMessage(create.error)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (amount.trim() === '' || Number(amount) <= 0) return
    create.mutate(
      { case_id: caseId, applicant_id: applicantId, direction, amount: Number(amount), currency, method, paid_at: paidAt || null },
      { onSuccess: () => { setAmount(''); onDone() } },
    )
  }

  return (
    <form onSubmit={submit} className="mt-2 grid grid-cols-1 gap-2.5 rounded-[12px] border border-line-2 bg-surface-2 p-3 sm:grid-cols-3">
      <TextField label={`金额（${currency}）`} type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <Select label="方式" options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} />
      <TextField label="日期" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
      {errMsg && <p className="text-xs text-rose-600 sm:col-span-3">记付款失败：{errMsg}</p>}
      <div className="flex items-end gap-2 sm:col-span-3">
        <Button type="submit" disabled={create.isPending || !(Number(amount) > 0)}>
          {create.isPending ? '保存中…' : '确认付款'}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>取消</Button>
      </div>
    </form>
  )
}

function PayableRow({
  caseId,
  title,
  direction,
  total,
  paid,
  owes,
  currency,
  onEdit,
}: {
  caseId: string
  title: string
  direction: PaymentDirection
  total: number | null
  paid: number
  owes: number
  currency: string
  onEdit: () => void
}) {
  const [recording, setRecording] = useState(false)
  const status = payableStatus(total, paid, owes)
  const unset = status === 'unset'

  return (
    <div className="rounded-[14px] bg-surface-2 px-4 py-3" data-testid={`payable-${direction}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink">{title}</span>
            {status === 'unset' ? (
              <span className="rounded-full bg-line-2 px-2 py-0.5 text-xs font-semibold text-faint">未设应付</span>
            ) : status === 'settled' ? (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600">已结清</span>
            ) : (
              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-600">欠 {formatMoney(owes, currency)}</span>
            )}
          </div>
          {!unset && (
            <div className="mt-0.5 text-[12px] text-faint">
              应付 {formatMoney(total, currency)} · 已付 {formatMoney(paid, currency)}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2.5 whitespace-nowrap text-[13px] font-semibold">
          {/* 主代理 / 介绍人都恒有「编辑 + 记付款」；未设应付时「编辑」即用于首次设置 */}
          <button type="button" onClick={onEdit} className="text-brand hover:text-brand-600">编辑</button>
          <button type="button" onClick={() => setRecording((v) => !v)} className="text-brand hover:text-brand-600">记付款</button>
        </div>
      </div>
      {recording && <QuickPayoutForm caseId={caseId} direction={direction} currency={currency} onDone={() => setRecording(false)} />}
    </div>
  )
}

/**
 * 主代理 / 介绍人应付：每行左侧状态(未设/已结清/欠，按真实数据派生) + 右侧操作（编辑/记付款 或 设置应付）。
 * 编辑/设置应付 → 现有应付编辑表单(PaymentPlanForm)；记付款 → 现有 useCreatePayment（方向固定）。
 */
export function PayablePanel({
  caseId,
  plan,
  currency,
  acct,
}: {
  caseId: string
  plan: PaymentPlan | undefined
  currency: string
  acct: Accounting
}) {
  // 编辑哪一方应付：主代理就是主代理、介绍人就是介绍人，互不混显
  const [editScope, setEditScope] = useState<'company' | 'referrer' | null>(null)

  return (
    <div>
      <h3 className="mb-4 text-base font-bold tracking-[-0.01em] text-ink">主代理 / 介绍人应付</h3>
      {editScope ? (
        <PaymentPlanForm
          caseId={caseId}
          initial={plan ?? undefined}
          defaultCurrency={currency}
          scope={editScope}
          onDone={() => setEditScope(null)}
        />
      ) : (
        <div className="space-y-2.5">
          <PayableRow
            caseId={caseId}
            title="你欠主代理"
            direction="to_company"
            total={plan?.company_total ?? null}
            paid={acct.companyPaid}
            owes={acct.companyOwes}
            currency={currency}
            onEdit={() => setEditScope('company')}
          />
          <PayableRow
            caseId={caseId}
            title="你欠介绍人"
            direction="to_referrer"
            total={plan?.referrer_total ?? null}
            paid={acct.referrerPaid}
            owes={acct.referrerOwes}
            currency={currency}
            onEdit={() => setEditScope('referrer')}
          />
        </div>
      )}
    </div>
  )
}
