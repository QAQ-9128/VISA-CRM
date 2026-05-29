import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCustomers, useUpdateCustomer } from '../../hooks/queries/useCustomers'
import { useCases } from '../../hooks/queries/useCases'
import { Button } from '../../components/ui/Button'
import { StarToggle } from '../../components/ui/StarToggle'
import { StageBadge } from '../../components/cases/StageBadge'
import { ClientSourceDot } from '../../components/customers/ClientSourceDot'
import { LoadingBlock, ErrorBlock, EmptyState } from '../../components/ui/states'
import { groupCustomersByFamily } from '../../lib/customerGroups'
import { formatVisaType } from '../../lib/visa'
import type { Case, Customer } from '../../types/models'

/** 一行客户：sub=true 时缩进并加连接线，视觉上挂在主申下面。cases = 该客户名下的案件。 */
function CustomerRow({ c, sub = false, cases = [] }: { c: Customer; sub?: boolean; cases?: Case[] }) {
  const update = useUpdateCustomer()
  return (
    <li className={`flex items-center gap-2 border-t border-slate-100 first:border-t-0 ${sub ? 'pl-3' : ''}`}>
      {sub && (
        <span className="select-none self-stretch pt-3 font-mono text-slate-300" aria-hidden>
          └─
        </span>
      )}
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
            <span className={`truncate text-slate-900 ${sub ? 'text-sm' : 'font-medium'}`}>{c.full_name}</span>
            <ClientSourceDot source={c.client_source} />
            {sub && c.relationship_to_primary && (
              <span className="text-xs text-slate-400">{c.relationship_to_primary}</span>
            )}
          </div>
          {cases.length === 0 ? (
            <p className="mt-0.5 text-sm text-slate-400">暂无案件</p>
          ) : (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              {cases.map((cs) => (
                <span key={cs.id} className="inline-flex items-center gap-1 text-xs text-slate-500">
                  {formatVisaType(cs.visa_subclass, cs.visa_stream)}
                  <StageBadge stage={cs.current_stage} />
                </span>
              ))}
            </div>
          )}
        </div>
        <span className="text-slate-300">›</span>
      </Link>
    </li>
  )
}

export function CustomerListPage() {
  const [search, setSearch] = useState('')
  const customers = useCustomers({ search })
  const cases = useCases()
  const groups = useMemo(() => groupCustomersByFamily(customers.data ?? []), [customers.data])
  // 客户 id → 其名下案件（用于每行显示「签证类别 · 状态」）
  const casesByCustomer = useMemo(() => {
    const m = new Map<string, Case[]>()
    for (const cs of cases.data ?? []) {
      const arr = m.get(cs.customer_id) ?? []
      arr.push(cs)
      m.set(cs.customer_id, arr)
    }
    return m
  }, [cases.data])

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
        ) : groups.length === 0 ? (
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
          // 组与组之间留间距；组内（主 + 副）无间隙、连成一块
          <div className="space-y-3">
            {groups.map((g) => (
              <div
                key={g.primary?.id ?? 'orphan'}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white px-3"
              >
                {g.orphan && (
                  <p className="border-b border-slate-100 py-2 text-xs text-amber-700">
                    以下副申请人的主申请人已被删除或归档
                  </p>
                )}
                <ul>
                  {g.primary && <CustomerRow c={g.primary} cases={casesByCustomer.get(g.primary.id) ?? []} />}
                  {g.subs.map((s) => (
                    <CustomerRow key={s.id} c={s} sub cases={casesByCustomer.get(s.id) ?? []} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
