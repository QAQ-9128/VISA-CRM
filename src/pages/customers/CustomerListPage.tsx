import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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
import { LoadingBlock, ErrorBlock, EmptyState } from '../../components/ui/states'
import { useCustomerDebts } from '../../hooks/queries/useCustomerDebts'
import { selectCustomerCases } from '../../lib/family'
import { selectCustomerCaseLines } from '../../lib/customerList'
import { selectSourceBoardColumns } from '../../lib/customerSourceBoard'
import type { SourceColumn } from '../../lib/customerSourceBoard'
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
import { CLIENT_SOURCES, CLIENT_SOURCE_DOT, CLIENT_SOURCE_LABELS } from '../../types/domain'
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

/**
 * 一行案件（签证 | 职位 | 雇主 | 阶段徽章）：点击 → 该客户详情并选中该案（案件详情页已删）。
 * 外层是客户 <a>（整行/整卡链到客户档案），HTML 不允许嵌套 <a> → 用 navigate + stopPropagation。
 */
function CaseLine({ line, customerId }: { line: ReturnType<typeof selectCustomerCaseLines>[number]; customerId: string }) {
  const navigate = useNavigate()
  const source = useBackSource()
  const open = (e: { preventDefault: () => void; stopPropagation: () => void }) => {
    e.preventDefault()
    e.stopPropagation()
    navigate(`/customers/${customerId}?case=${line.caseId}`, { state: source })
  }
  return (
    <div
      role="link"
      tabIndex={0}
      title="查看案件详情"
      aria-label={`查看案件 ${line.fields[0] ?? ''}`}
      onClick={open}
      onKeyDown={(e) => e.key === 'Enter' && open(e)}
      className="group/case flex w-fit cursor-pointer flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted"
    >
      {line.fields.map((f, i) => (
        <span key={i} className="flex items-center gap-x-1.5">
          {i > 0 && <span className="text-line-2" aria-hidden>|</span>}
          {/* 首字段=签证类型：hover 变绿下划线，提示可点 */}
          <span className={i === 0 ? 'font-medium text-body group-hover/case:text-brand group-hover/case:underline' : ''}>{f}</span>
        </span>
      ))}
      <span className="text-line-2" aria-hidden>|</span>
      <StageBadge stage={line.stage} />
    </div>
  )
}

/** 一行客户（组内平铺，不分主/副）。cases = 该客户名下/参与的案件。 */
function CustomerRow({
  c,
  cases = [],
  employerName = null,
  paymentColor = 'default',
  relationship = null,
}: {
  c: Customer
  cases?: Case[]
  employerName?: string | null
  paymentColor?: CustomerPaymentColor
  /** 关系说明（非角色，如 配偶/子女），有则淡显 */
  relationship?: string | null
}) {
  const update = useUpdateCustomer()
  const source = useBackSource()
  const lines = selectCustomerCaseLines(c, cases, employerName)
  // 付款颜色按「归集后欠款(billed_to)」判断：blue=还欠钱 / green=已付清 / default=无
  const nameColor = paymentColor === 'default' ? '' : CUSTOMER_PAYMENT_TEXT_CLASS[paymentColor]
  return (
    <li className="flex items-center gap-2 border-t border-line first:border-t-0">
      <StarToggle
        starred={c.is_starred}
        disabled={update.isPending}
        onToggle={(e) => {
          e.preventDefault()
          update.mutate({ id: c.id, patch: { is_starred: !c.is_starred } })
        }}
      />
      <Link to={`/customers/${c.id}`} state={source} className="flex min-h-12 min-w-0 flex-1 items-center gap-3 py-3 pr-2">
        <Avatar name={c.full_name} seed={c.id} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`truncate text-[15px] font-semibold ${nameColor || 'text-ink'}`}>
              {c.full_name}
            </span>
            <ClientSourceDot source={c.client_source} />
            {relationship && <span className="text-xs text-faint">{relationship}</span>}
          </div>
          {cases.length === 0 ? (
            <p className="mt-0.5 text-xs text-faint">暂无案件</p>
          ) : (
            <div className="mt-1 space-y-1">
              {/* 每案一行：签证类型 | 职位 | 担保雇主 | 状态。点击整行 → 客户详情并选中该案 */}
              {lines.map((line) => (
                <CaseLine key={line.caseId} line={line} customerId={c.id} />
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
  // 视图存进 URL（?view=board）：刷新/返回保持同一视图（与案件页同模式）
  const [searchParams, setSearchParams] = useSearchParams()
  const view: 'list' | 'board' = searchParams.get('view') === 'board' ? 'board' : 'list'
  const setView = (v: 'list' | 'board') =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (v === 'board') next.set('view', 'board')
        else next.delete('view')
        return next
      },
      { replace: true },
    )
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filter, setFilter] = useState<CustomerFilter>(EMPTY_CUSTOMER_FILTER)
  const customers = useCustomers({ search })
  const cases = useCases()
  const applicants = useAllCaseApplicants()
  const employers = useEmployers()
  const referrers = useReferrers()
  const { colorByCustomerId } = useCustomerDebts()
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

  // 平铺客户（一案一组后客户列表不再按组出卡）：命中筛选的客户，星标在前
  const visibleCustomers = useMemo(() => {
    const list = (customers.data ?? []).filter((c) => customerMatches(c, filter, subclassesByCustomerId))
    return [...list].sort((a, b) => Number(b.is_starred) - Number(a.is_starred))
  }, [customers.data, filter, subclassesByCustomerId])
  // 看板：按来源分列（黑=公司派 / 绿=自己 / 黄=擦屁股 + 未分类兜底），沿用同一份筛选结果
  const boardColumns = useMemo(() => selectSourceBoardColumns(visibleCustomers), [visibleCustomers])

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
  // 该行显示的案件：TA 拥有的 ∪ 作为参与人参加的（卡片下方「参与了哪些案件」）
  const displayCasesOf = (c: Customer) =>
    selectCustomerCases(c.id, cases.data ?? [], applicants.data ?? [])

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">客户列表</h1>
          <p className="mt-0.5 text-sm text-muted">追踪并管理客户关系 · 每位客户列出 TA 参与的案件</p>
        </div>
        <Link to="/customers/new">
          <Button>
            <PlusIcon className="size-[18px]" /> 新建客户
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* 列表 / 看板（按来源三色分列）段控 */}
        <div className="inline-flex gap-1 rounded-full bg-surface-2 p-1">
          {(['list', 'board'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-full px-4 py-2 text-[13.5px] font-semibold transition-colors ${
                view === v ? 'bg-white text-brand shadow-xs' : 'text-muted hover:text-body'
              }`}
            >
              {v === 'list' ? '列表' : '看板'}
            </button>
          ))}
        </div>

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

      <div>
        {customers.isPending ? (
          <LoadingBlock />
        ) : customers.isError ? (
          <ErrorBlock error={customers.error} />
        ) : visibleCustomers.length === 0 ? (
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
        ) : view === 'board' ? (
          // 看板：黑(公司派) / 绿(自己) / 黄(擦屁股) 三列按来源分；与列表共用同一份筛选/搜索结果
          <SourceBoard columns={boardColumns} casesOf={displayCasesOf} employerNameOf={employerNameOf} />
        ) : (
          // 平铺客户（一案一组：组随案件走，客户列表不再按组出卡）；每行=客户名 + TA 参与的案件
          <div className="overflow-hidden rounded-card bg-white px-[18px] shadow-soft">
            <ul>
              {visibleCustomers.map((m) => (
                <CustomerRow
                  key={m.id}
                  c={m}
                  relationship={m.relationship_to_primary}
                  cases={displayCasesOf(m)}
                  employerName={employerNameOf(m)}
                  paymentColor={colorByCustomerId[m.id] ?? 'default'}
                />
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}

// 看板列顶部色条：黑(公司派 'red' 显示为柔和黑) / 绿 / 黄 / 灰(未分类)
const COLUMN_ACCENT: Record<string, string> = {
  red: 'border-t-slate-900',
  green: 'border-t-green-600',
  yellow: 'border-t-yellow-500',
  none: 'border-t-slate-300',
}

/**
 * 客户来源看板：固定三列 黑(公司派)/绿(自己)/黄(帮别人擦屁股)（+未分类灰列兜底）。
 * 卡片 = 客户名(星标在前) + TA 参与的案件行（签证 | 职位 | 雇主 | 阶段），点击进客户档案。
 */
function SourceBoard({
  columns,
  casesOf,
  employerNameOf,
}: {
  columns: SourceColumn[]
  casesOf: (c: Customer) => Case[]
  employerNameOf: (c: Customer) => string | null
}) {
  const source = useBackSource()
  return (
    <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-3">
      {columns.map((col) => {
        const key = col.source ?? 'none'
        return (
          <div key={key} className={`rounded-card border-t-4 bg-white p-3.5 shadow-soft ${COLUMN_ACCENT[key]}`}>
            <div className="mb-2.5 flex items-center gap-2 border-b border-line pb-2.5">
              <span
                aria-hidden
                className={`size-2.5 shrink-0 rounded-full ${col.source ? CLIENT_SOURCE_DOT[col.source] : 'bg-slate-300'}`}
              />
              <h2 className="text-[14px] font-bold text-ink">
                {col.source ? CLIENT_SOURCE_LABELS[col.source] : '未分类'}
              </h2>
              <span className="ml-auto text-[12px] text-faint">{col.customers.length} 人</span>
            </div>

            {col.customers.length === 0 ? (
              <p className="py-5 text-center text-sm text-faint">暂无客户</p>
            ) : (
              <ul className="space-y-2">
                {col.customers.map((m) => {
                  const lines = selectCustomerCaseLines(m, casesOf(m), employerNameOf(m))
                  return (
                    <li key={m.id}>
                      <Link
                        to={`/customers/${m.id}`}
                        state={source}
                        className="block rounded-[12px] border border-line px-3 py-2.5 transition-colors hover:border-brand-100 hover:bg-brand-50/40"
                      >
                        <div className="flex items-center gap-1.5">
                          {m.is_starred && <span aria-hidden className="text-[13px] text-amber-500">★</span>}
                          <span className="truncate text-sm font-semibold text-ink">{m.full_name}</span>
                        </div>
                        {lines.length === 0 ? (
                          <p className="mt-0.5 text-xs text-faint">暂无案件</p>
                        ) : (
                          <div className="mt-1 space-y-1">
                            {/* 点签证行 → 客户详情并选中该案（卡片其余区域仍进客户档案） */}
                            {lines.map((line) => (
                              <CaseLine key={line.caseId} line={line} customerId={m.id} />
                            ))}
                          </div>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
