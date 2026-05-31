import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { Textarea } from '../ui/Textarea'
import { useCreatePaymentPlan, useUpdatePaymentPlan } from '../../hooks/queries/usePayments'
import { useCustomers } from '../../hooks/queries/useCustomers'
import { useCase } from '../../hooks/queries/useCases'
import type { PaymentPlan } from '../../types/models'

const numOrNull = (s: string) => (s.trim() === '' ? null : Number(s))
const inputCls =
  'block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200'

export function PaymentPlanForm({
  caseId,
  initial,
  defaultCurrency = 'AUD',
  onDone,
}: {
  caseId: string
  initial?: PaymentPlan
  defaultCurrency?: string
  onDone: () => void
}) {
  const create = useCreatePaymentPlan(caseId)
  const update = useUpdatePaymentPlan(caseId)
  const saving = create.isPending || update.isPending
  const saveErr = create.error ?? update.error
  const saveErrMsg = saveErr instanceof Error ? saveErr.message : saveErr ? '保存失败' : null

  // 应收客户总额(client_total)已改为「款项明细」派生，这里不再录入；只设主代理/货币/备注。
  const [companyTotal, setCompanyTotal] = useState(initial?.company_total?.toString() ?? '')
  const [currency, setCurrency] = useState(initial?.currency ?? defaultCurrency)
  const [note, setNote] = useState(initial?.note ?? '')
  // 账单付款方：空 = 默认归案件主申请；可改为任意客户（跨家庭组）
  const [billedTo, setBilledTo] = useState(initial?.billed_to_customer_id ?? '')
  const [billedQuery, setBilledQuery] = useState('')

  const caseQ = useCase(caseId)
  const customersQ = useCustomers({})
  const allCustomers = useMemo(() => customersQ.data ?? [], [customersQ.data])
  const primaryName =
    allCustomers.find((c) => c.id === caseQ.data?.customer_id)?.full_name ?? '主申请'
  const billedOptions = useMemo(() => {
    const q = billedQuery.trim().toLowerCase()
    const base = q === '' ? allCustomers : allCustomers.filter((c) => c.full_name.toLowerCase().includes(q))
    // 当前已选项始终保留，避免下拉值落空
    if (billedTo && !base.some((c) => c.id === billedTo)) {
      const sel = allCustomers.find((c) => c.id === billedTo)
      return sel ? [sel, ...base] : base
    }
    return base
  }, [billedQuery, allCustomers, billedTo])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const fields = {
      company_total: numOrNull(companyTotal),
      currency: currency.trim() || 'AUD',
      note: note.trim() || null,
      billed_to_customer_id: billedTo || null,
    }
    if (initial) {
      update.mutate({ id: initial.id, patch: fields }, { onSuccess: onDone })
    } else {
      create.mutate({ case_id: caseId, ...fields }, { onSuccess: onDone })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-indigo-200 bg-indigo-50/40 p-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <TextField
          label="应付主代理总额"
          type="number"
          min={0}
          step="0.01"
          value={companyTotal}
          onChange={(e) => setCompanyTotal(e.target.value)}
        />
        <TextField label="货币" value={currency} onChange={(e) => setCurrency(e.target.value)} />
      </div>
      <p className="text-xs text-slate-400">客户应收已改为「款项明细」逐条管理（律师费/文案费等），此处只设主代理应付。</p>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-slate-700">账单付款方（可选）</label>
        <p className="text-xs text-slate-400">
          该案件费用归集到谁名下。留空默认归主申请「{primaryName}」；可设为任意客户（家庭成员 / 介绍人 / 其他付款人）。
        </p>
        <input
          type="text"
          value={billedQuery}
          onChange={(e) => setBilledQuery(e.target.value)}
          placeholder="搜索客户姓名…"
          className={inputCls}
        />
        <select
          aria-label="账单付款方"
          className={inputCls}
          value={billedTo}
          onChange={(e) => setBilledTo(e.target.value)}
        >
          <option value="">（默认：{primaryName}）</option>
          {billedOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name}
            </option>
          ))}
        </select>
      </div>

      <Textarea label="备注" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />

      {saveErrMsg && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">保存失败：{saveErrMsg}</p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? '保存中…' : '保存'}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          取消
        </Button>
      </div>
    </form>
  )
}
