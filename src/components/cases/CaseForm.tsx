import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { VisaSubclassField } from './VisaSubclassField'
import type { Case, CaseInsert } from '../../types/models'

export interface CaseFormValues extends CaseInsert {
  customer_id: string
  visa_subclass: string
}

interface CaseFormProps {
  customerId: string
  customerLabel: string
  initial?: Case
  submitting?: boolean
  error?: string | null
  onSubmit: (values: CaseFormValues) => void
  onCancel: () => void
}

const trimOrNull = (s: string) => (s.trim() === '' ? null : s.trim())

export function CaseForm({
  customerId,
  customerLabel,
  initial,
  submitting,
  error,
  onSubmit,
  onCancel,
}: CaseFormProps) {
  const [visaSubclass, setVisaSubclass] = useState(initial?.visa_subclass ?? '')
  const [destination, setDestination] = useState(initial?.destination_country ?? 'Australia')
  const [currency, setCurrency] = useState(initial?.currency ?? 'AUD')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSubmit({
      customer_id: customerId,
      visa_subclass: visaSubclass.trim(),
      destination_country: trimOrNull(destination),
      currency: currency.trim() || 'AUD',
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <span className="block text-sm font-medium text-slate-700">客户</span>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
          {customerLabel}
        </div>
      </div>

      <VisaSubclassField value={visaSubclass} onChange={setVisaSubclass} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField
          label="目的国"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
        />
        <TextField
          label="货币"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          placeholder="AUD"
        />
      </div>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={submitting || visaSubclass.trim() === ''}>
          {submitting ? '保存中…' : '保存'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          取消
        </Button>
      </div>
    </form>
  )
}
