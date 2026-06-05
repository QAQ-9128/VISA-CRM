import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import { TextField } from '../ui/TextField'
import { OwnerSelect } from './OwnerSelect'
import { ReferrerSelect } from '../referrers/ReferrerSelect'
import { useCreateCustomer } from '../../hooks/queries/useCustomers'
import { initialQuickState, toQuickPayload } from '../../lib/quickCustomer'
import { errorMessage } from '../../lib/errorMessage'
import { GENDERS, GENDER_LABELS } from '../../types/domain'

/**
 * 快速建档卡片（与完整表单同页并存，2026-06 图纸拍板）：
 * 姓名/性别/生日/归属人/介绍人 五个字段，建完即进客户档案。
 * 不含任何案件逻辑——客户后续有案件，去客户详情页「新建案件」里建。
 */
export function QuickCustomerForm({
  onCreated,
}: {
  /** 创建成功（调用方负责跳转，通常 navigate 到客户详情） */
  onCreated: (customerId: string) => void
}) {
  const createM = useCreateCustomer()
  const [state, setState] = useState(initialQuickState())
  const set = <K extends keyof typeof state>(key: K) => (value: (typeof state)[K]) =>
    setState((s) => ({ ...s, [key]: value }))
  const errMsg = errorMessage(createM.error)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!state.full_name.trim() || createM.isPending) return
    createM.mutate(toQuickPayload(state), {
      onSuccess: (created) => onCreated(created.id),
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4" aria-label="快速建档">
      <TextField
        label="姓名"
        required
        value={state.full_name}
        onChange={(e) => set('full_name')(e.target.value)}
        placeholder="客户姓名"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label="性别"
          placeholder="未填写"
          options={GENDERS.map((g) => ({ value: g, label: GENDER_LABELS[g] }))}
          value={state.gender}
          onChange={(e) => set('gender')(e.target.value)}
        />
        <TextField
          label="生日"
          type="date"
          value={state.birth_date}
          onChange={(e) => set('birth_date')(e.target.value)}
        />
      </div>
      <OwnerSelect
        value={state.owner_referrer_id || null}
        onChange={(id) => set('owner_referrer_id')(id ?? '')}
      />
      <ReferrerSelect value={state.referrer_id} onChange={(id) => set('referrer_id')(id)} />

      {errMsg && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">创建失败：{errMsg}</p>
      )}

      <Button type="submit" block disabled={!state.full_name.trim() || createM.isPending}>
        {createM.isPending ? '保存中…' : '快速建档'}
      </Button>
    </form>
  )
}
