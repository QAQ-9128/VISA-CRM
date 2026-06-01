import { useState } from 'react'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { Select } from '../ui/Select'
import { useAddFamilyMember } from '../../hooks/queries/useCustomers'
import {
  FAMILY_RELATIONSHIPS,
  RELATIONSHIP_OTHER,
  buildFamilyMemberPayload,
  validateFamilyMember,
} from '../../lib/familyMember'
import type { FamilyMemberForm } from '../../lib/familyMember'
import type { Customer } from '../../types/models'

const EMPTY: FamilyMemberForm = { full_name: '', gender: '', birth_date: '', relationship: '', relationshipOther: '' }

const GENDER_OPTIONS = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
]
const RELATION_OPTIONS = FAMILY_RELATIONSHIPS.map((r) => ({ value: r, label: r }))

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * 「+ 一键添加家庭成员」轻量入口：只填 姓名/性别/生日/关系 四字段，
 * 快速建一个挂靠当前主申请的客户行。只创建「人」，不建 case、不联动 sync、不触发 TRT。
 * 当前客户本身是某人的副申请时按钮置灰（只能在主申请名下添加）。
 */
export function QuickAddFamilyMember({ customer }: { customer: Customer }) {
  const isSub = !!customer.primary_applicant_id
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FamilyMemberForm>(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const add = useAddFamilyMember(customer.id)

  const set = <K extends keyof FamilyMemberForm>(k: K, v: FamilyMemberForm[K]) =>
    setForm((p) => ({ ...p, [k]: v }))

  function save(continueAdding: boolean) {
    const err = validateFamilyMember(form)
    if (err) {
      setError(err)
      return
    }
    setError(null)
    add.mutate(buildFamilyMemberPayload(form), {
      onSuccess: () => {
        if (continueAdding) setForm(EMPTY) // 清空表单、留在弹窗，连续添加
        else {
          setForm(EMPTY)
          setOpen(false)
        }
      },
    })
  }

  if (isSub) {
    return (
      <button
        type="button"
        disabled
        title="只能在主申请名下添加家庭成员。该客户本身是某人的副申请。"
        className="inline-flex min-h-11 cursor-not-allowed items-center rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-300"
      >
        + 一键添加家庭成员
      </button>
    )
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        + 一键添加家庭成员
      </Button>
    )
  }

  const saveErr = add.error instanceof Error ? add.error.message : add.error ? '保存失败' : null

  return (
    <div className="w-full space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
      <p className="text-sm font-medium text-slate-700">快速添加家庭成员（挂到「{customer.full_name}」名下）</p>

      <TextField
        label="姓名 *"
        required
        value={form.full_name}
        onChange={(e) => set('full_name', e.target.value)}
        placeholder="成员姓名"
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Select
          label="性别"
          placeholder="未填"
          options={GENDER_OPTIONS}
          value={form.gender}
          onChange={(e) => set('gender', e.target.value)}
        />
        <TextField
          label="生日"
          type="date"
          max={todayStr()}
          value={form.birth_date}
          onChange={(e) => set('birth_date', e.target.value)}
        />
      </div>

      <Select
        label="与主申请关系"
        placeholder="未选"
        options={RELATION_OPTIONS}
        value={form.relationship}
        onChange={(e) => set('relationship', e.target.value)}
      />
      {form.relationship === RELATIONSHIP_OTHER && (
        <TextField
          label="关系（手填）"
          value={form.relationshipOther}
          onChange={(e) => set('relationshipOther', e.target.value)}
          placeholder="如 岳母 / 继女"
        />
      )}

      {(error || saveErr) && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error ?? saveErr}</p>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="button" disabled={add.isPending} onClick={() => save(false)}>
          {add.isPending ? '保存中…' : '保存'}
        </Button>
        <Button type="button" variant="secondary" disabled={add.isPending} onClick={() => save(true)}>
          保存并继续添加
        </Button>
        <Button type="button" variant="ghost" onClick={() => { setOpen(false); setForm(EMPTY); setError(null) }}>
          取消
        </Button>
      </div>
    </div>
  )
}
