import { useState } from 'react'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import { TextField } from '../ui/TextField'
import { useCreateReferrer, useReferrers } from '../../hooks/queries/useReferrers'

/** 介绍人选择器：下拉选已有 + 内联新建。用于客户表单（嵌在 form 内，按钮均 type=button）。 */
export function ReferrerSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (referrerId: string) => void
}) {
  const referrers = useReferrers()
  const create = useCreateReferrer()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')

  const options = (referrers.data ?? []).map((r) => ({ value: r.id, label: r.name }))

  function handleCreate() {
    create.mutate(
      { name: name.trim(), contact_phone: phone.trim() || null },
      {
        onSuccess: (ref) => {
          onChange(ref.id)
          setCreating(false)
          setName('')
          setPhone('')
        },
      },
    )
  }

  if (creating) {
    return (
      <div className="space-y-3 rounded-lg border border-indigo-200 bg-indigo-50/40 p-3">
        <TextField label="新介绍人姓名 *" value={name} onChange={(e) => setName(e.target.value)} placeholder="如 王经理" />
        <TextField label="联系电话（可选）" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <div className="flex gap-2">
          <Button type="button" onClick={handleCreate} disabled={create.isPending || name.trim() === ''}>
            {create.isPending ? '创建中…' : '创建并选用'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
            取消
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <Select
          label="介绍人"
          placeholder="无 / 未指定"
          options={options}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      <Button type="button" variant="secondary" onClick={() => setCreating(true)}>
        + 新建
      </Button>
    </div>
  )
}
