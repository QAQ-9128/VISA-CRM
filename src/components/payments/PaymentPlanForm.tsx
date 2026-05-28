import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { Textarea } from '../ui/Textarea'
import { useCreatePaymentPlan, useUpdatePaymentPlan } from '../../hooks/queries/usePayments'
import type { PaymentPlan } from '../../types/models'

const numOrNull = (s: string) => (s.trim() === '' ? null : Number(s))

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

  const [clientTotal, setClientTotal] = useState(initial?.client_total?.toString() ?? '')
  const [companyTotal, setCompanyTotal] = useState(initial?.company_total?.toString() ?? '')
  const [currency, setCurrency] = useState(initial?.currency ?? defaultCurrency)
  const [note, setNote] = useState(initial?.note ?? '')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const fields = {
      client_total: numOrNull(clientTotal),
      company_total: numOrNull(companyTotal),
      currency: currency.trim() || 'AUD',
      note: note.trim() || null,
    }
    if (initial) {
      update.mutate({ id: initial.id, patch: fields }, { onSuccess: onDone })
    } else {
      create.mutate({ case_id: caseId, ...fields }, { onSuccess: onDone })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-indigo-200 bg-indigo-50/40 p-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <TextField
          label="应收客户总额"
          type="number"
          min={0}
          step="0.01"
          value={clientTotal}
          onChange={(e) => setClientTotal(e.target.value)}
        />
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
      <Textarea label="备注" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
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
