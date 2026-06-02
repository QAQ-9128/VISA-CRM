import { useState } from 'react'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import { TextField } from '../ui/TextField'
import { useCreateEmployer, useEmployers } from '../../hooks/queries/useEmployers'

/** 担保雇主选择器：下拉选已有 + 内联新建。用于客户表单（嵌在 form 内，按钮均 type=button）。 */
export function EmployerSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (employerId: string) => void
}) {
  const employers = useEmployers()
  const create = useCreateEmployer()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [abn, setAbn] = useState('')

  const options = (employers.data ?? []).map((e) => ({ value: e.id, label: e.name }))

  function handleCreate() {
    create.mutate(
      { name: name.trim(), abn: abn.trim() || null },
      {
        onSuccess: (emp) => {
          onChange(emp.id)
          setCreating(false)
          setName('')
          setAbn('')
        },
      },
    )
  }

  if (creating) {
    return (
      <div className="space-y-3 rounded-lg border border-brand-100 bg-brand-50/40 p-3">
        <TextField label="新雇主名称 *" value={name} onChange={(e) => setName(e.target.value)} placeholder="如 ACME Pty Ltd" />
        <TextField label="ABN（可选）" value={abn} onChange={(e) => setAbn(e.target.value)} />
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
          label="担保雇主"
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
