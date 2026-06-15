import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
import { CustomerActionsMenu } from '../../components/customers/CustomerActionsMenu'
import { LoadingBlock, ErrorBlock, EmptyState } from '../../components/ui/states'
import { useCustomerDebts } from '../../hooks/queries/useCustomerDebts'
import { selectCustomerCases } from '../../lib/family'
import { customerDisplayName } from '../../lib/customerName'
import { selectCustomerCaseLines } from '../../lib/customerList'
import {
  matchesCustomerFilter,
  matchesVisaFilter,
  customerFilterCount,
  caseNumberMatchedCustomerIds,
  EMPTY_CUSTOMER_FILTER,
  type CustomerFilter,
  type SourceFilterValue,
} from '../../lib/customersFilter'
import { ownerFacetOptions } from '../../lib/ownerFilter'
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
        <Avatar name={customerDisplayName(c)} seed={c.id} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`truncate text-[15px] font-semibold ${nameColor || 'text-ink'}`}>
              {customerDisplayName(c)}
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
      {/* 行级操作：归档 / 彻底删除（admin）——在 Link 之外，点击不会跳详情 */}
      <div className="mr-1 shrink-0">
        <CustomerActionsMenu customer={c} />
      </div>
    </li>
  )
}

export function CustomerListPage() {
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filter, setFilter] = useState<CustomerFilter>(EMPTY_CUSTOMER_FILTER)
  const customers = useCustomers({ search })
  // 案件号搜索补充：服务端只搜姓名/电话/邮箱，全量客户用于把"案件号命中"的客户并进来
  const allCustomers = useCustomers({})
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

  // 服务端搜索（姓名/电话/邮箱）∪ 案件号命中（客户端派生）→ 搜"那个 482 的案子"也能找到人
  const searchedCustomers = useMemo(() => {
    const base = customers.data ?? []
    if (!search.trim()) return base
    const extraIds = caseNumberMatchedCustomerIds(search, cases.data ?? [], applicants.data ?? [])
    if (extraIds.size === 0) return base
    const have = new Set(base.map((c) => c.id))
    const extras = (allCustomers.data ?? []).filter((c) => extraIds.has(c.id) && !have.has(c.id))
    return [...base, ...extras]
  }, [customers.data, allCustomers.data, cases.data, applicants.data, search])

  // 平铺客户（一案一组后客户列表不再按组出卡）：命中筛选的客户，星标在前
  const visibleCustomers = useMemo(() => {
    const list = searchedCustomers.filter((c) => customerMatches(c, filter, subclassesByCustomerId))
    return [...list].sort((a, b) => Number(b.is_starred) - Number(a.is_starred))
  }, [searchedCustomers, filter, subclassesByCustomerId])
  // 签证类别筛选项：只列已有案件出现过的签证子类
  const visaOptions = useMemo(
    () => [...new Set((cases.data ?? []).map((c) => c.visa_subclass).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [cases.data],
  )

  // 客户归属人筛选项 = 现有归属值 distinct（与案件筛选栏共用 lib/ownerFilter 同一套逻辑）；
  // 名字从介绍人同表（kind=owner）解析；取全量客户，避免搜索时选项跟着缩水
  const ownerOptions = useMemo(() => {
    const nameById = new Map((referrers.data ?? []).map((r) => [r.id, r.name]))
    return ownerFacetOptions(
      (allCustomers.data ?? []).map((c) => ({
        ownerId: c.owner_referrer_id,
        ownerName: c.owner_referrer_id ? nameById.get(c.owner_referrer_id) ?? '' : '',
      })),
    )
  }, [allCustomers.data, referrers.data])
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
        <div className="flex h-11 min-w-[220px] flex-1 items-center gap-2.5 rounded-full border border-line-2 bg-white px-4 text-faint shadow-xs focus-within:border-brand focus-within:ring-2 focus-within:ring-brand-100">
          <SearchIcon className="size-[18px] shrink-0" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索姓名 / 电话 / 邮箱 / 案件号"
            className="h-full w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-faint"
          />
        </div>
        <FilterButton
          active={showFilters || filterCount > 0}
          count={filterCount}
          onClick={() => setShowFilters((s) => !s)}
        />
      </div>

      {/* 筛选面板：优先(星标) / 来源 / 客户归属人 / 案件类型，自由点选组合 */}
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

          {/* 客户归属人（customers.owner_referrer_id）：选项=现有归属值 distinct；替代旧的担保雇主/介绍人筛选 */}
          {ownerOptions.length > 0 && (
            <FilterGroup label="客户归属人">
              {ownerOptions.map((o) => (
                <Chip
                  key={o.id}
                  active={filter.ownerIds.has(o.id)}
                  onClick={() => setFilter((f) => ({ ...f, ownerIds: toggleIn(f.ownerIds, o.id) }))}
                >
                  {o.name}
                </Chip>
              ))}
            </FilterGroup>
          )}

          {visaOptions.length > 0 && (
            <FilterGroup label="案件类型">
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
        {customers.isPending || cases.isPending || applicants.isPending ? (
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
        ) : (
          // 平铺客户（一案一组：组随案件走，客户列表不再按组出卡）；每行=客户名 + TA 参与的案件
          // 注意：容器不能 overflow-hidden——行尾「⋯」菜单（归档/彻底删除）是 absolute 弹层，会被裁掉看不见
          <div className="rounded-card bg-white px-[18px] shadow-soft">
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
