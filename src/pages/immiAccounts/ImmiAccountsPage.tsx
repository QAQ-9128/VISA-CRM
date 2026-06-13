import { useState } from 'react'
import type { FormEvent } from 'react'
import { useCreateImmiAccount, useDeleteImmiAccount, useImmiAccounts } from '../../hooks/queries/useImmiAccounts'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { TextField } from '../../components/ui/TextField'
import { Well } from '../../components/ui/Well'
import { useConfirm } from '../../components/ui/useConfirm'
import { countCasesUsingImmiAccount } from '../../api/immiAccounts'
import { ClipboardIcon, PlusIcon } from '../../components/ui/icons'
import { LoadingBlock, ErrorBlock, EmptyState } from '../../components/ui/states'
import type { ImmiAccount } from '../../types/models'

function AccountRow({ a }: { a: ImmiAccount }) {
  const del = useDeleteImmiAccount()
  const { confirm, confirmNode } = useConfirm()
  return (
    <li className="flex min-h-12 items-center gap-3 border-t border-line py-3 first:border-t-0">
      <Well tone="indigo" size={42}>
        <ClipboardIcon className="size-[22px]" />
      </Well>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{a.name}</span>
      <button
        type="button"
        disabled={del.isPending}
        className="inline-flex min-h-11 shrink-0 items-center px-2 text-xs text-faint hover:text-rose-600"
        onClick={async () => {
          let n: number
          try {
            n = await countCasesUsingImmiAccount(a.id)
          } catch {
            n = -1
          }
          const description =
            n > 0
              ? `「${a.name}」正被 ${n} 个案件用作所属账号。删除后这些案件的所属账号将清空为「未指定」。确定删除？`
              : n < 0
                ? `删除账号「${a.name}」？引用此账号的案件其所属账号将清空为「未指定」。`
                : `删除账号「${a.name}」？`
          if (await confirm({ title: '删除账号', description, confirmLabel: '删除', tone: 'danger' }))
            del.mutate(a.id)
        }}
      >
        删除
      </button>
      {confirmNode}
    </li>
  )
}

/** 所属账号（移民局递交账号 ImmiAccount）管理：列出全部账号 + 就地新建 + 删除。一账号可被多个案件复用。 */
export function ImmiAccountsPage() {
  const accounts = useImmiAccounts()
  const create = useCreateImmiAccount()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (name.trim() === '') return
    create.mutate(
      { name: name.trim() },
      { onSuccess: () => { setName(''); setAdding(false) } },
    )
  }

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">所属账号</h1>
          <p className="mt-0.5 text-sm text-muted">移民局递交账号（ImmiAccount）：新建案件 / 编辑案件时可选用，一账号可复用于多个案件</p>
        </div>
        {!adding && (
          <Button onClick={() => setAdding(true)}>
            <PlusIcon className="size-[18px]" /> 新建账号
          </Button>
        )}
      </div>

      {adding && (
        <Card>
          <form onSubmit={handleCreate} className="space-y-3">
            <TextField
              label="账号名称"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如 ImmiAccount-公司 1 号"
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={create.isPending || name.trim() === ''}>
                {create.isPending ? '创建中…' : '创建'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => { setAdding(false); setName('') }}>
                取消
              </Button>
            </div>
          </form>
        </Card>
      )}

      {accounts.isPending ? (
        <LoadingBlock />
      ) : accounts.isError ? (
        <ErrorBlock error={accounts.error} />
      ) : accounts.data.length === 0 ? (
        <EmptyState
          title="还没有所属账号"
          icon="🗂️"
          action={!adding ? <Button onClick={() => setAdding(true)}>新建第一个账号</Button> : undefined}
        />
      ) : (
        <Card>
          <ul>
            {accounts.data.map((a) => (
              <AccountRow key={a.id} a={a} />
            ))}
          </ul>
        </Card>
      )}
    </section>
  )
}
