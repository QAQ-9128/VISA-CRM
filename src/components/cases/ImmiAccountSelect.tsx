import { useState } from 'react'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import { TextField } from '../ui/TextField'
import { useConfirm } from '../ui/useConfirm'
import { useCreateImmiAccount, useDeleteImmiAccount, useImmiAccounts } from '../../hooks/queries/useImmiAccounts'
import { countCasesUsingImmiAccount } from '../../api/immiAccounts'

/**
 * 所属账号选择器（移民局系统账号 lookup）：下拉选已有 + 就地新增 + 就地删除（管理面板）。
 * 用于案件表单（新建/编辑，嵌在 form 内，按钮均 type=button）；账号建一次即可被多个案件复用。
 * 删除=软删（从下拉移除，已用此账号的案件不受影响）；完整管理另有独立页 /immi-accounts。
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
  const del = useDeleteImmiAccount()
  const { confirm, confirmNode } = useConfirm()
  const [creating, setCreating] = useState(false)
  const [managing, setManaging] = useState(false)
  const [name, setName] = useState('')

  const list = accounts.data ?? []
  const options = list.map((a) => ({ value: a.id, label: a.name }))

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

  async function handleDelete(id: string, label: string) {
    // 删除前查用量：被 N 个案件引用则提示「删除后这些案件的所属账号将清空为未指定」
    let n: number
    try {
      n = await countCasesUsingImmiAccount(id)
    } catch {
      n = -1 // 计数失败：按未知处理，给出通用提示
    }
    const description =
      n > 0
        ? `「${label}」正被 ${n} 个案件用作所属账号。删除后这些案件的所属账号将清空为「未指定」。确定删除？`
        : n < 0
          ? `删除账号「${label}」？引用此账号的案件其所属账号将清空为「未指定」。`
          : `删除账号「${label}」？`
    if (await confirm({ title: '删除账号', description, confirmLabel: '删除', tone: 'danger' })) {
      del.mutate(id, { onSuccess: () => { if (value === id) onChange('') } })
    }
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
    <div className="space-y-2">
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

      {/* 管理：就地删除已有账号（软删，从下拉移除；已用案件不受影响） */}
      {list.length > 0 && (
        <button
          type="button"
          onClick={() => setManaging((v) => !v)}
          className="text-xs font-semibold text-muted hover:text-brand"
        >
          {managing ? '收起管理' : '管理账号'}
        </button>
      )}
      {managing && list.length > 0 && (
        <ul className="rounded-lg border border-line-2 bg-surface-2/50 p-1.5">
          {list.map((a) => (
            <li key={a.id} className="flex items-center gap-2 rounded-md px-2 py-1.5">
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{a.name}</span>
              <button
                type="button"
                disabled={del.isPending}
                onClick={() => handleDelete(a.id, a.name)}
                className="inline-flex min-h-11 shrink-0 items-center px-2 text-xs font-medium text-faint hover:text-rose-600 disabled:opacity-50"
              >
                删除
              </button>
            </li>
          ))}
        </ul>
      )}
      {confirmNode}
    </div>
  )
}
