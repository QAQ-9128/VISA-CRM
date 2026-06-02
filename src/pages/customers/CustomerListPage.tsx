import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCustomers, useUpdateCustomer } from '../../hooks/queries/useCustomers'
import { useCases } from '../../hooks/queries/useCases'
import { useAllCaseApplicants } from '../../hooks/queries/useCaseApplicants'
import { useEmployers } from '../../hooks/queries/useEmployers'
import { useReferrers } from '../../hooks/queries/useReferrers'
import { useBackSource } from '../../hooks/useBackSource'
import { Button } from '../../components/ui/Button'
import { StarToggle } from '../../components/ui/StarToggle'
import { Avatar } from '../../components/ui/Avatar'
import { Card } from '../../components/ui/Card'
import { Chip, FilterButton, FilterGroup } from '../../components/ui/filters'
import { PlusIcon, SearchIcon } from '../../components/ui/icons'
import { StageBadge } from '../../components/cases/StageBadge'
import { ClientSourceDot } from '../../components/customers/ClientSourceDot'
import { CustomerBoard } from '../../components/customers/CustomerBoard'
import { LoadingBlock, ErrorBlock, EmptyState } from '../../components/ui/states'
import { useCustomerDebts } from '../../hooks/queries/useCustomerDebts'
import { useFamilyLinks } from '../../hooks/queries/useFamilyLinks'
import { groupCustomersByFamily } from '../../lib/customerGroups'
import type { FamilyGroup } from '../../lib/customerGroups'
import { selectCustomerCaseLines, selectDisplayCases } from '../../lib/customerList'
import {
  matchesCustomerFilter,
  matchesVisaFilter,
  customerFilterCount,
  EMPTY_CUSTOMER_FILTER,
  type CustomerFilter,
  type SourceFilterValue,
} from '../../lib/customersFilter'
import { CUSTOMER_PAYMENT_TEXT_CLASS } from '../../lib/finance'
import type { CustomerPaymentColor } from '../../lib/finance'
import { CLIENT_SOURCES, CLIENT_SOURCE_LABELS } from '../../types/domain'
import type { Case, Customer } from '../../types/models'

/** 来源筛选项：三色 + 未分类。 */
const SOURCE_OPTIONS: { value: SourceFilterValue; label: string }[] = [
  ...CLIENT_SOURCES.map((s) => ({ value: s as SourceFilterValue, label: CLIENT_SOURCE_LABELS[s] })),
  { value: 'unclassified', label: '未分类' },
]

/** 切换 Set 里某个值（不可变）。 */
function toggleIn<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

/** 单客户是否同时命中属性筛选 + 签证类别（按其名下案件签证集）。 */
function customerMatches(c: Customer, f: CustomerFilter, subByCustomer: Map<string, string[]>): boolean {
  return matchesCustomerFilter(c, f) && matchesVisaFilter(f, subByCustomer.get(c.id) ?? [])
}

/** 家庭组是否命中筛选：主申或任一副申命中即保留整组。 */
function groupMatchesFilter(g: FamilyGroup, f: CustomerFilter, subByCustomer: Map<string, string[]>): boolean {
  if (g.primary && customerMatches(g.primary, f, subByCustomer)) return true
  return g.subs.some((s) => customerMatches(s.customer, f, subByCustomer))
}

/** 一行客户：sub=true 时缩进并加连接线，视觉上挂在主申下面。cases = 该客户名下的案件。 */
function CustomerRow({
  c,
  sub = false,
  cases = [],
  employerName = null,
  paymentColor = 'default',
  linked = false,
  relationship = null,
}: {
  c: Customer
  sub?: boolean
  cases?: Case[]
  employerName?: string | null
  paymentColor?: CustomerPaymentColor
  /** true = 通过关联表挂进来的「已有独立档案」客户 */
  linked?: boolean
  /** 副申关系标签：原生取 c.relationship_to_primary，关联取 link.relationship */
  relationship?: string | null
}) {
  const update = useUpdateCustomer()
  const source = useBackSource()
  const lines = selectCustomerCaseLines(c, cases, employerName)
  // 付款颜色按「归集后欠款(billed_to)」判断：blue=还欠钱 / green=已付清 / default=无
  const nameColor = paymentColor === 'default' ? '' : CUSTOMER_PAYMENT_TEXT_CLASS[paymentColor]
  return (
    <li className={`flex items-center gap-2 border-t border-line first:border-t-0 ${sub ? 'pl-3' : ''}`}>
      {sub && (
        <span className="select-none self-stretch pt-4 font-mono text-line-2" aria-hidden>
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
      <Link to={`/customers/${c.id}`} state={source} className="flex min-h-12 min-w-0 flex-1 items-center gap-3 py-3 pr-2">
        <Avatar name={c.full_name} seed={c.id} size={sub ? 34 : 40} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`truncate ${nameColor || 'text-ink'} ${sub ? 'text-sm font-medium' : 'text-[15px] font-semibold'}`}>
              {c.full_name}
            </span>
            <ClientSourceDot source={c.client_source} />
            {sub && relationship && <span className="text-xs text-faint">{relationship}</span>}
            {linked && (
              <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand" title="已有独立档案，点进去是她本人档案">
                ↗ 独立档案
              </span>
            )}
          </div>
          {cases.length === 0 ? (
            <p className="mt-0.5 text-xs text-faint">暂无案件</p>
          ) : (
            <div className="mt-1 space-y-1">
              {/* 每案一行：签证类型 | 职位 | 担保雇主 | 状态（空字段跳过、| 自适应；状态为彩色徽章） */}
              {lines.map((line) => (
                <div key={line.caseId} className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted">
                  {line.fields.map((f, i) => (
                    <span key={i} className="flex items-center gap-x-1.5">
                      {i > 0 && <span className="text-line-2" aria-hidden>|</span>}
                      <span>{f}</span>
                    </span>
                  ))}
                  <span className="text-line-2" aria-hidden>|</span>
                  <StageBadge stage={line.stage} />
                </div>
              ))}
            </div>
          )}
        </div>
        <span className="text-line-2">›</span>
      </Link>
    </li>
  )
}

export function CustomerListPage() {
  const [view, setView] = useState<'board' | 'list'>('board')
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filter, setFilter] = useState<CustomerFilter>(EMPTY_CUSTOMER_FILTER)
  const customers = useCustomers({ search })
  const cases = useCases()
  const applicants = useAllCaseApplicants()
  const employers = useEmployers()
  const referrers = useReferrers()
  const { colorByCustomerId } = useCustomerDebts()
  const familyLinks = useFamilyLinks()
  const groups = useMemo(
    () => groupCustomersByFamily(customers.data ?? [], familyLinks.data ?? []),
    [customers.data, familyLinks.data],
  )
  // 客户 → 名下案件的签证集（主申 + 作为副申参与的），用于「签证类别」筛选
  const subclassesByCustomerId = useMemo(() => {
    const caseById = new Map((cases.data ?? []).map((c) => [c.id, c]))
    const m = new Map<string, string[]>()
    const add = (cid: string, sub: string) => {
      const arr = m.get(cid)
      if (arr) { if (!arr.includes(sub)) arr.push(sub) } else m.set(cid, [sub])
    }
    for (const c of cases.data ?? []) if (c.visa_subclass) add(c.customer_id, c.visa_subclass)
    for (const a of applicants.data ?? []) {
      const c = caseById.get(a.case_id)
      if (c?.visa_subclass) add(a.customer_id, c.visa_subclass)
    }
    return m
  }, [cases.data, applicants.data])

  // 列表：保留命中筛选的家庭组（主申或任一副申命中）
  const visibleGroups = useMemo(
    () => groups.filter((g) => groupMatchesFilter(g, filter, subclassesByCustomerId)),
    [groups, filter, subclassesByCustomerId],
  )

  // 签证类别筛选项：只列已有案件出现过的签证子类
  const visaOptions = useMemo(
    () => [...new Set((cases.data ?? []).map((c) => c.visa_subclass).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [cases.data],
  )

  // 筛选项 = 全部雇主 / 介绍人主数据（暂无客户也列出），按名排序
  const sortedEmployers = useMemo(
    () => (employers.data ?? []).map((e) => ({ id: e.id, name: e.name })).sort((a, b) => a.name.localeCompare(b.name)),
    [employers.data],
  )
  const sortedReferrers = useMemo(
    () => (referrers.data ?? []).map((r) => ({ id: r.id, name: r.name })).sort((a, b) => a.name.localeCompare(b.name)),
    [referrers.data],
  )
  const filterCount = customerFilterCount(filter)
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
    <section className={`mx-auto space-y-5 ${view === 'board' ? 'max-w-[1280px]' : 'max-w-3xl'}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">客户</h1>
          <p className="mt-0.5 text-sm text-muted">追踪并管理客户关系 · 按案件阶段查看销售渠道</p>
        </div>
        <Link to="/customers/new">
          <Button>
            <PlusIcon className="size-[18px]" /> 新建客户
          </Button>
        </Link>
      </div>

      {/* 视图切换：看板 / 列表（段控） */}
      <div className="inline-flex gap-1 rounded-full bg-surface-2 p-1">
        {(['board', 'list'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`rounded-full px-4 py-2 text-[13.5px] font-semibold transition-colors ${
              view === v ? 'bg-white text-brand shadow-xs' : 'text-muted hover:text-body'
            }`}
          >
            {v === 'board' ? '看板' : '列表'}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-11 min-w-[220px] flex-1 items-center gap-2.5 rounded-full border border-line-2 bg-white px-4 text-faint shadow-xs focus-within:border-brand focus-within:ring-2 focus-within:ring-brand-100">
          <SearchIcon className="size-[18px] shrink-0" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索姓名 / 电话 / 邮箱"
            className="h-full w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-faint"
          />
        </div>
        <FilterButton
          active={showFilters || filterCount > 0}
          count={filterCount}
          onClick={() => setShowFilters((s) => !s)}
        />
      </div>

      {/* 筛选面板：来源 / 担保雇主 / 介绍人 / 星标，自由点选组合 */}
      {showFilters && (
        <Card className="space-y-3.5">
          <FilterGroup label="优先">
            <Chip active={filter.starredOnly} onClick={() => setFilter((f) => ({ ...f, starredOnly: !f.starredOnly }))}>
              ★ 只看星标
            </Chip>
          </FilterGroup>

          <FilterGroup label="来源">
            {SOURCE_OPTIONS.map((s) => (
              <Chip
                key={s.value}
                active={filter.sources.has(s.value)}
                onClick={() => setFilter((f) => ({ ...f, sources: toggleIn(f.sources, s.value) }))}
              >
                {s.value !== 'unclassified' && <ClientSourceDot source={s.value} />}
                {s.label}
              </Chip>
            ))}
          </FilterGroup>

          {sortedEmployers.length > 0 && (
            <FilterGroup label="担保雇主">
              {sortedEmployers.map((e) => (
                <Chip
                  key={e.id}
                  active={filter.employerIds.has(e.id)}
                  onClick={() => setFilter((f) => ({ ...f, employerIds: toggleIn(f.employerIds, e.id) }))}
                >
                  {e.name}
                </Chip>
              ))}
            </FilterGroup>
          )}

          {sortedReferrers.length > 0 && (
            <FilterGroup label="介绍人">
              {sortedReferrers.map((r) => (
                <Chip
                  key={r.id}
                  active={filter.referrerIds.has(r.id)}
                  onClick={() => setFilter((f) => ({ ...f, referrerIds: toggleIn(f.referrerIds, r.id) }))}
                >
                  {r.name}
                </Chip>
              ))}
            </FilterGroup>
          )}

          {visaOptions.length > 0 && (
            <FilterGroup label="签证类别">
              {visaOptions.map((sc) => (
                <Chip
                  key={sc}
                  active={filter.subclasses.has(sc)}
                  onClick={() => setFilter((f) => ({ ...f, subclasses: toggleIn(f.subclasses, sc) }))}
                >
                  {sc}
                </Chip>
              ))}
            </FilterGroup>
          )}

          {filterCount > 0 && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setFilter(EMPTY_CUSTOMER_FILTER)}
                className="text-[13px] font-semibold text-muted hover:text-brand"
              >
                清除筛选
              </button>
            </div>
          )}
        </Card>
      )}

      {view === 'board' && <CustomerBoard search={search} filter={filter} />}

      {view === 'list' && (
        <div>
        {customers.isPending ? (
          <LoadingBlock />
        ) : customers.isError ? (
          <ErrorBlock error={customers.error} />
        ) : visibleGroups.length === 0 ? (
          <EmptyState
            title={search || filterCount > 0 ? '没有匹配的客户' : '还没有客户'}
            icon="🧑‍💼"
            action={
              !search && filterCount === 0 ? (
                <Link to="/customers/new">
                  <Button>新建第一个客户</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          // 组与组之间留间距；组内（主 + 副）无间隙、连成一块
          <div className="space-y-4">
            {visibleGroups.map((g) => (
              <div
                key={g.primary?.id ?? 'orphan'}
                className="overflow-hidden rounded-card bg-white px-[18px] shadow-soft"
              >
                {g.orphan && (
                  <p className="border-b border-line py-2 text-xs text-amber-700">
                    以下副申请人的主申请人已被删除或归档
                  </p>
                )}
                <ul>
                  {g.primary && (
                    <CustomerRow
                      c={g.primary}
                      cases={displayCasesOf(g.primary)}
                      employerName={employerNameOf(g.primary)}
                      paymentColor={colorByCustomerId[g.primary.id] ?? 'default'}
                    />
                  )}
                  {g.subs.map((s) => (
                    <CustomerRow
                      key={`${g.primary?.id ?? 'orphan'}:${s.customer.id}`}
                      c={s.customer}
                      sub
                      linked={s.linked}
                      relationship={s.relationship}
                      cases={displayCasesOf(s.customer)}
                      employerName={employerNameOf(s.customer)}
                      paymentColor={colorByCustomerId[s.customer.id] ?? 'default'}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        </div>
      )}
    </section>
  )
}
