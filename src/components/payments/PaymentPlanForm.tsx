import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { Textarea } from '../ui/Textarea'
import { useCreatePaymentPlan, useUpdatePaymentPlan } from '../../hooks/queries/usePayments'
import type { PaymentPlanUpdate } from '../../api/payments'
import { useCustomers } from '../../hooks/queries/useCustomers'
import { useCase } from '../../hooks/queries/useCases'
import { customerDisplayName } from '../../lib/customerName'
import { errorMessage } from '../../lib/errorMessage'
import type { PaymentPlan } from '../../types/models'

const numOrNull = (s: string) => (s.trim() === '' ? null : Number(s))
const inputCls =
  'block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand-100'

export function PaymentPlanForm({
  caseId,
  initial,
  defaultCurrency = 'AUD',
  scope = 'both',
  onDone,
}: {
  caseId: string
  initial?: PaymentPlan
  defaultCurrency?: string
  /** 只编辑某一方应付：'company'=主代理 / 'referrer'=介绍人 / 'both'=两者（默认）。 */
  scope?: 'company' | 'referrer' | 'both'
  onDone: () => void
}) {
  const showCompany = scope !== 'referrer'
  const showReferrer = scope !== 'company'
  const heading = scope === 'company' ? '编辑主代理应付' : scope === 'referrer' ? '编辑介绍人应付' : null
  const create = useCreatePaymentPlan(caseId)
  const update = useUpdatePaymentPlan(caseId)
  const saving = create.isPending || update.isPending
  // 显示后端真实原因（Supabase PostgrestError 是普通对象，旧的 instanceof Error 抓不到 → 会吞成「保存失败」）
  const saveErrMsg = errorMessage(create.error ?? update.error)

  // 应收客户总额(client_total)已改为「款项明细」派生，这里不再录入；只设主代理/介绍人应付/货币/备注。
  const [companyTotal, setCompanyTotal] = useState(initial?.company_total?.toString() ?? '')
  const [referrerTotal, setReferrerTotal] = useState(initial?.referrer_total?.toString() ?? '')
  const [currency, setCurrency] = useState(initial?.currency ?? defaultCurrency)
  const [note, setNote] = useState(initial?.note ?? '')
  // 账单付款方：空 = 默认归案件主申请；可改为任意客户（跨家庭组）
  const [billedTo, setBilledTo] = useState(initial?.billed_to_customer_id ?? '')
  const [billedQuery, setBilledQuery] = useState('')

  const caseQ = useCase(caseId)
  const customersQ = useCustomers({})
  const allCustomers = useMemo(() => customersQ.data ?? [], [customersQ.data])
  const primaryName =
    customerDisplayName(allCustomers.find((c) => c.id === caseQ.data?.customer_id)) || '主申请'
  const billedOptions = useMemo(() => {
    const q = billedQuery.trim().toLowerCase()
    const base = q === '' ? allCustomers : allCustomers.filter((c) => customerDisplayName(c).toLowerCase().includes(q))
    // 当前已选项始终保留，避免下拉值落空
    if (billedTo && !base.some((c) => c.id === billedTo)) {
      const sel = allCustomers.find((c) => c.id === billedTo)
      return sel ? [sel, ...base] : base
    }
    return base
  }, [billedQuery, allCustomers, billedTo])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    // 只写当前 scope 涉及的应付字段，避免编辑主代理时误覆盖介绍人（反之亦然）
    const fields: PaymentPlanUpdate = {
      currency: currency.trim() || 'AUD',
      note: note.trim() || null,
      billed_to_customer_id: billedTo || null,
    }
    if (showCompany) fields.company_total = numOrNull(companyTotal)
    if (showReferrer) fields.referrer_total = numOrNull(referrerTotal)
    if (initial) {
      update.mutate({ id: initial.id, patch: fields }, { onSuccess: onDone })
    } else {
      create.mutate({ case_id: caseId, ...fields }, { onSuccess: onDone })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-brand-100 bg-brand-50/40 p-3">
      {heading && <p className="text-sm font-bold text-ink">{heading}</p>}
      <div className={`grid grid-cols-1 gap-3 ${showCompany && showReferrer ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
        {showCompany && (
          <TextField
            label="应付主代理总额"
            type="number"
            min={0}
            step="0.01"
            value={companyTotal}
            onChange={(e) => setCompanyTotal(e.target.value)}
          />
        )}
        {showReferrer && (
          <TextField
            label="应付介绍人总额"
            type="number"
            min={0}
            step="0.01"
            value={referrerTotal}
            onChange={(e) => setReferrerTotal(e.target.value)}
          />
        )}
        <TextField label="货币" value={currency} onChange={(e) => setCurrency(e.target.value)} />
      </div>
      <p className="text-xs text-slate-400">
        客户应收已改为「款项明细」逐条管理（律师费/文案费等），此处只设
        {scope === 'company' ? '主代理' : scope === 'referrer' ? '介绍人' : '主代理 / 介绍人'}应付。
      </p>

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
              {customerDisplayName(c)}
            </option>
          ))}
        </select>
      </div>

      <Textarea label="备注" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />

      {saveErrMsg && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          保存失败：{saveErrMsg}
          {/^Could not find.*referrer_total|PGRST204/i.test(saveErrMsg) && (
            <span className="mt-1 block text-xs text-rose-500">
              「介绍人应付总额」列还没建——请在 Supabase 跑迁移 0028_referrer_total.sql 后重试。
            </span>
          )}
        </p>
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
