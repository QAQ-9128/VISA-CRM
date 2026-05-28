import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { VisaSubclassField } from './VisaSubclassField'
import { useSubApplicants } from '../../hooks/queries/useCustomers'
import type { Case, CaseInsert } from '../../types/models'

export interface CaseFormValues extends CaseInsert {
  customer_id: string
  visa_subclass: string
  sync_tracking: boolean
}

interface CaseFormProps {
  customerId: string
  customerLabel: string
  initial?: Case
  /** 编辑时回填已选的副申请人客户 id */
  initialApplicantIds?: string[]
  submitting?: boolean
  error?: string | null
  onSubmit: (values: CaseFormValues, applicantIds: string[]) => void
  onCancel: () => void
}

const trimOrNull = (s: string) => (s.trim() === '' ? null : s.trim())

export function CaseForm({
  customerId,
  customerLabel,
  initial,
  initialApplicantIds,
  submitting,
  error,
  onSubmit,
  onCancel,
}: CaseFormProps) {
  const [visaSubclass, setVisaSubclass] = useState(initial?.visa_subclass ?? '')
  const [destination, setDestination] = useState(initial?.destination_country ?? 'Australia')
  const [currency, setCurrency] = useState(initial?.currency ?? 'AUD')
  const [syncTracking, setSyncTracking] = useState(initial?.sync_tracking ?? true)
  const [applicantIds, setApplicantIds] = useState<string[]>(initialApplicantIds ?? [])

  // 候选副申请人 = 该主申客户名下的家庭成员
  const subs = useSubApplicants(customerId)

  function toggleApplicant(id: string) {
    setApplicantIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSubmit(
      {
        customer_id: customerId,
        visa_subclass: visaSubclass.trim(),
        destination_country: trimOrNull(destination),
        currency: currency.trim() || 'AUD',
        sync_tracking: syncTracking,
      },
      applicantIds,
    )
  }

  const candidates = subs.data ?? []

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <span className="block text-sm font-medium text-slate-700">主申请客户</span>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
          {customerLabel}
        </div>
      </div>

      <VisaSubclassField value={visaSubclass} onChange={setVisaSubclass} />

      <fieldset className="rounded-xl border border-slate-200 p-4">
        <legend className="px-1 text-sm font-medium text-slate-600">副申请人 / 同步追踪</legend>
        <div className="space-y-3">
          {candidates.length === 0 ? (
            <p className="text-sm text-slate-400">该客户名下暂无家庭成员（副申请人）。可先到客户档案添加副申请人。</p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-slate-500">选择本案件包含的副申请人：</p>
              {candidates.map((c) => (
                <label key={c.id} className="flex min-h-11 items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={applicantIds.includes(c.id)}
                    onChange={() => toggleApplicant(c.id)}
                    className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  {c.full_name}
                  {c.relationship_to_primary ? <span className="text-slate-400">（{c.relationship_to_primary}）</span> : null}
                </label>
              ))}
            </div>
          )}

          <label className="flex items-start gap-2 border-t border-slate-100 pt-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={syncTracking}
              onChange={(e) => setSyncTracking(e.target.checked)}
              className="mt-0.5 size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>
              同步追踪（勾选 = 主申 + 副申一起追踪、账单合并；不勾 = 主申、各副申分开追踪、账单分开）
            </span>
          </label>
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField label="目的国" value={destination} onChange={(e) => setDestination(e.target.value)} />
        <TextField label="货币" value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="AUD" />
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
