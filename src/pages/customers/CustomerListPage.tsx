import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCustomers, useUpdateCustomer } from '../../hooks/queries/useCustomers'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { StarToggle } from '../../components/ui/StarToggle'
import { LoadingBlock, ErrorBlock, EmptyState } from '../../components/ui/states'
import { CUSTOMER_TIER_LABELS } from '../../types/domain'
import type { Customer } from '../../types/models'

const TIER_STYLE: Record<string, string> = {
  vip: 'bg-amber-100 text-amber-800',
  a: 'bg-indigo-100 text-indigo-700',
  b: 'bg-slate-100 text-slate-700',
  c: 'bg-slate-100 text-slate-600',
}

function CustomerRow({ c }: { c: Customer }) {
  const update = useUpdateCustomer()
  return (
    <li className="flex items-center gap-2 border-b border-slate-100 last:border-0">
      <StarToggle
        starred={c.is_starred}
        disabled={update.isPending}
        onToggle={(e) => {
          e.preventDefault()
          update.mutate({ id: c.id, patch: { is_starred: !c.is_starred } })
        }}
      />
      <Link to={`/customers/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3 py-3 pr-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-slate-900">{c.full_name}</span>
            {c.priority_tier && (
              <Badge className={TIER_STYLE[c.priority_tier]}>
                {CUSTOMER_TIER_LABELS[c.priority_tier]}
              </Badge>
            )}
            {c.primary_applicant_id && <Badge>副申请人</Badge>}
          </div>
          <p className="truncate text-sm text-slate-500">
            {c.phone || c.email || c.wechat || '—'}
          </p>
        </div>
        <span className="text-slate-300">›</span>
      </Link>
    </li>
  )
}

export function CustomerListPage() {
  const [search, setSearch] = useState('')
  const customers = useCustomers({ search })

  return (
    <section className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">客户</h1>
        <Link to="/customers/new">
          <Button>+ 新建客户</Button>
        </Link>
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="搜索姓名 / 电话 / 邮箱"
        className="mt-4 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
      />

      <div className="mt-4">
        {customers.isPending ? (
          <LoadingBlock />
        ) : customers.isError ? (
          <ErrorBlock error={customers.error} />
        ) : customers.data.length === 0 ? (
          <EmptyState
            title={search ? '没有匹配的客户' : '还没有客户'}
            action={
              !search && (
                <Link to="/customers/new">
                  <Button>新建第一个客户</Button>
                </Link>
              )
            }
          />
        ) : (
          <ul className="overflow-hidden rounded-xl border border-slate-200 bg-white px-3">
            {customers.data.map((c) => (
              <CustomerRow key={c.id} c={c} />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
