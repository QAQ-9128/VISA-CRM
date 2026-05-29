import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { Textarea } from '../ui/Textarea'
import { Select } from '../ui/Select'
import { EmployerSelect } from '../employers/EmployerSelect'
import { ReferrerSelect } from '../referrers/ReferrerSelect'
import { usePrimaryApplicants } from '../../hooks/queries/useCustomers'
import { CUSTOMER_TIERS, CUSTOMER_TIER_LABELS, GENDERS, GENDER_LABELS } from '../../types/domain'
import type { CustomerTier } from '../../types/domain'
import type { Customer, CustomerInsert } from '../../types/models'

export interface CustomerFormValues extends CustomerInsert {
  full_name: string
}

interface FormState {
  full_name: string
  primary_applicant_id: string
  relationship_to_primary: string
  priority_tier: string
  is_starred: boolean
  sponsor_employer_id: string
  referrer_id: string
  birth_date: string
  gender: string
  notes: string
}

function toState(c?: Customer): FormState {
  return {
    full_name: c?.full_name ?? '',
    primary_applicant_id: c?.primary_applicant_id ?? '',
    relationship_to_primary: c?.relationship_to_primary ?? '',
    priority_tier: c?.priority_tier ?? '',
    is_starred: c?.is_starred ?? false,
    sponsor_employer_id: c?.sponsor_employer_id ?? '',
    referrer_id: c?.referrer_id ?? '',
    birth_date: c?.birth_date ?? '',
    gender: c?.gender ?? '',
    notes: c?.notes ?? '',
  }
}

const trimOrNull = (s: string) => (s.trim() === '' ? null : s.trim())

// 注意：电话/微信/邮箱/护照号/国籍/地址 已从表单移除，且**不写进 payload** —
// 编辑时这些键不出现在 update patch 里，数据库现有数据得以保留（不被清空）。
function toPayload(s: FormState): CustomerFormValues {
  const isSub = s.primary_applicant_id !== ''
  return {
    full_name: s.full_name.trim(),
    primary_applicant_id: isSub ? s.primary_applicant_id : null,
    relationship_to_primary: isSub ? trimOrNull(s.relationship_to_primary) : null,
    priority_tier: (s.priority_tier || null) as CustomerTier | null,
    is_starred: s.is_starred,
    sponsor_employer_id: s.sponsor_employer_id || null,
    referrer_id: s.referrer_id || null,
    birth_date: trimOrNull(s.birth_date),
    gender: s.gender || null,
    notes: trimOrNull(s.notes),
  }
}

interface CustomerFormProps {
  /** 编辑时传入现有客户 */
  initial?: Customer
  submitting?: boolean
  error?: string | null
  onSubmit: (values: CustomerFormValues) => void
  onCancel: () => void
}

export function CustomerForm({ initial, submitting, error, onSubmit, onCancel }: CustomerFormProps) {
  const [state, setState] = useState<FormState>(() => toState(initial))
  const primaries = usePrimaryApplicants()

  const set =
    <K extends keyof FormState>(key: K) =>
    (value: FormState[K]) =>
      setState((prev) => ({ ...prev, [key]: value }))

  // 主申请人下拉：排除自己（编辑时），未归档的主申请人
  const primaryOptions = (primaries.data ?? [])
    .filter((c) => c.id !== initial?.id)
    .map((c) => ({ value: c.id, label: c.full_name }))

  const tierOptions = CUSTOMER_TIERS.map((t) => ({ value: t, label: CUSTOMER_TIER_LABELS[t] }))

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSubmit(toPayload(state))
  }

  const isSub = state.primary_applicant_id !== ''

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <TextField
        label="姓名 *"
        required
        value={state.full_name}
        onChange={(e) => set('full_name')(e.target.value)}
        placeholder="客户姓名"
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Select
          label="客户等级"
          placeholder="未分级"
          options={tierOptions}
          value={state.priority_tier}
          onChange={(e) => set('priority_tier')(e.target.value)}
        />
        <label className="flex items-end gap-2 pb-2 text-sm text-slate-700 md:pb-3">
          <input
            type="checkbox"
            checked={state.is_starred}
            onChange={(e) => set('is_starred')(e.target.checked)}
            className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          标注为优先客户（星标）
        </label>
      </div>

      <EmployerSelect
        value={state.sponsor_employer_id}
        onChange={(id) => set('sponsor_employer_id')(id)}
      />

      <ReferrerSelect
        value={state.referrer_id}
        onChange={(id) => set('referrer_id')(id)}
      />

      <fieldset className="rounded-xl border border-slate-200 p-4">
        <legend className="px-1 text-sm font-medium text-slate-600">家庭组 / 主副申请人</legend>
        <div className="space-y-4">
          <Select
            label="作为副申请人挂靠到（留空 = 本人是主申请人）"
            placeholder="— 本人是主申请人 —"
            options={primaryOptions}
            value={state.primary_applicant_id}
            onChange={(e) => set('primary_applicant_id')(e.target.value)}
          />
          {isSub && (
            <TextField
              label="与主申请人关系"
              value={state.relationship_to_primary}
              onChange={(e) => set('relationship_to_primary')(e.target.value)}
              placeholder="如 配偶 / 子女 / 父母"
            />
          )}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField
          label="生日"
          type="date"
          value={state.birth_date}
          onChange={(e) => set('birth_date')(e.target.value)}
        />
        <Select
          label="性别"
          placeholder="未填"
          options={GENDERS.map((g) => ({ value: g, label: GENDER_LABELS[g] }))}
          value={state.gender}
          onChange={(e) => set('gender')(e.target.value)}
        />
      </div>

      <Textarea
        label="备注"
        value={state.notes}
        onChange={(e) => set('notes')(e.target.value)}
      />

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={submitting || state.full_name.trim() === ''}>
          {submitting ? '保存中…' : '保存'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          取消
        </Button>
      </div>
    </form>
  )
}
