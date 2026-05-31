import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCustomers, useUpdateCustomer } from '../../hooks/queries/useCustomers'
import { useCases } from '../../hooks/queries/useCases'
import { useAllCaseApplicants } from '../../hooks/queries/useCaseApplicants'
import { useEmployers } from '../../hooks/queries/useEmployers'
import { Button } from '../../components/ui/Button'
import { StarToggle } from '../../components/ui/StarToggle'
import { StageBadge } from '../../components/cases/StageBadge'
import { ClientSourceDot } from '../../components/customers/ClientSourceDot'
import { LoadingBlock, ErrorBlock, EmptyState } from '../../components/ui/states'
import { groupCustomersByFamily } from '../../lib/customerGroups'
import { selectCustomerCaseLines, selectDisplayCases } from '../../lib/customerList'
import type { Case, Customer } from '../../types/models'

/** 一行客户：sub=true 时缩进并加连接线，视觉上挂在主申下面。cases = 该客户名下的案件。 */
function CustomerRow({
  c,
  sub = false,
  cases = [],
  employerName = null,
}: {
  c: Customer
  sub?: boolean
  cases?: Case[]
  employerName?: string | null
}) {
  const update = useUpdateCustomer()
  const lines = selectCustomerCaseLines(c, cases, employerName)
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
            <div className="mt-0.5 space-y-1">
              {/* 每案一行：签证类型 | 职位 | 担保雇主 | 状态（空字段跳过、| 自适应；状态为彩色徽章） */}
              {lines.map((line) => (
                <div key={line.caseId} className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-500">
                  {line.fields.map((f, i) => (
                    <span key={i} className="flex items-center gap-x-1.5">
                      {i > 0 && <span className="text-slate-300" aria-hidden>|</span>}
                      <span>{f}</span>
                    </span>
                  ))}
                  <span className="text-slate-300" aria-hidden>|</span>
                  <StageBadge stage={line.stage} />
                </div>
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
  const applicants = useAllCaseApplicants()
  const employers = useEmployers()
  const groups = useMemo(() => groupCustomersByFamily(customers.data ?? []), [customers.data])
  // 担保雇主 id → name（每行显示「担保雇主」用）
  const employerNameById = useMemo(() => {
    const m: Record<string, string> = {}
    for (const e of employers.data ?? []) m[e.id] = e.name
    return m
  }, [employers.data])
  const employerNameOf = (c: Customer) =>
    c.sponsor_employer_id ? employerNameById[c.sponsor_employer_id] ?? null : null
  // 该行显示的案件：主申优先，否则取作为副申参与的案件（修复副申客户显示"暂无案件"）
  const displayCasesOf = (c: Customer) =>
    selectDisplayCases(c.id, cases.data ?? [], applicants.data ?? [])

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
                  {g.primary && (
                    <CustomerRow
                      c={g.primary}
                      cases={displayCasesOf(g.primary)}
                      employerName={employerNameOf(g.primary)}
                    />
                  )}
                  {g.subs.map((s) => (
                    <CustomerRow
                      key={s.id}
                      c={s}
                      sub
                      cases={displayCasesOf(s)}
                      employerName={employerNameOf(s)}
                    />
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
