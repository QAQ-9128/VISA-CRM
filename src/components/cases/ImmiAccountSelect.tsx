import { useState } from 'react'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import { TextField } from '../ui/TextField'
import { useCreateImmiAccount, useImmiAccounts } from '../../hooks/queries/useImmiAccounts'

/**
 * 所属账号选择器（移民局系统账号 lookup）：下拉选已有 + 就地新增。
 * 用于案件表单（嵌在 form 内，按钮均 type=button）；账号建一次即可被多个案件复用。
 * 按钮文案用「+ 新增」（区别于同表单内担保雇主的「+ 新建」，避免按钮名撞车）。
 */
export function ImmiAccountSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (accountId: string) => void
}) {
  const accounts = useImmiAccounts()
  const create = useCreateImmiAccount()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  const options = (accounts.data ?? []).map((a) => ({ value: a.id, label: a.name }))

  function handleCreate() {
    create.mutate(
      { name: name.trim() },
      {
        onSuccess: (acc) => {
          onChange(acc.id)
          setCreating(false)
          setName('')
        },
      },
    )
  }

  if (creating) {
    return (
      <div className="space-y-3 rounded-lg border border-brand-100 bg-brand-50/40 p-3">
        <TextField
          label="新账号名称"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="如 ImmiAccount-公司 1 号"
        />
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
          label="所属账号"
          placeholder="未指定"
          options={options}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      <Button type="button" variant="secondary" onClick={() => setCreating(true)}>
        + 新增
      </Button>
    </div>
  )
}
