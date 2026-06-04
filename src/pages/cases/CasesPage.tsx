import { Fragment, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useBackSource } from '../../hooks/useBackSource'
import { useAllLodgements } from '../../hooks/queries/useLodgements'
import { useCases, useAllStageHistory } from '../../hooks/queries/useCases'
import { useCustomers } from '../../hooks/queries/useCustomers'
import { useAllCaseApplicants } from '../../hooks/queries/useCaseApplicants'
import { useOpenRecords } from '../../hooks/queries/useRecords'
import { useEmployers } from '../../hooks/queries/useEmployers'
import { useReferrers } from '../../hooks/queries/useReferrers'
import { clusterRowsByGroup, groupPositions, selectCaseRows } from '../../lib/casesTable'
import {
  selectCaseListRows,
  filterCaseListRows,
  caseFilterFacets,
  type CaseListFilter,
  type CaseListRow,
} from '../../lib/casesList'
import { visibleCaseIds } from '../../lib/visibility'
import { CASE_STAGE_LABELS } from '../../types/domain'
import type { CaseStage } from '../../types/domain'
import { StageBadge } from '../../components/cases/StageBadge'
import { LodgementProgressTable } from '../../components/cases/LodgementProgressTable'
import { Avatar } from '../../components/ui/Avatar'
import { Card } from '../../components/ui/Card'
import { Chip, FilterButton, FilterGroup } from '../../components/ui/filters'
import { SearchIcon, ChevronRightIcon } from '../../components/ui/icons'
import { LoadingBlock, ErrorBlock, EmptyState } from '../../components/ui/states'

type View = 'list' | 'lodge'

/** 切换 Set 里某个值（不可变）。 */
function toggle<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

export function CasesPage() {
  const navigate = useNavigate()
  const lodgements = useAllLodgements()
  const cases = useCases()
  const customers = useCustomers({})
  const applicants = useAllCaseApplicants()
  const stageHistory = useAllStageHistory()
  const tasks = useOpenRecords()
  const employers = useEmployers()
  const referrers = useReferrers()

  // tab 存进 URL（?view=lodge），这样从某个 tab 进案件详情再返回能回到同一 tab
  const [searchParams, setSearchParams] = useSearchParams()
  const view: View = searchParams.get('view') === 'lodge' ? 'lodge' : 'list'
  const setView = (v: View) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (v === 'lodge') next.set('view', 'lodge')
        else next.delete('view')
        return next
      },
      { replace: true },
    )
  const [showFilters, setShowFilters] = useState(false)
  const [filter, setFilter] = useState<CaseListFilter>({
    search: '',
    stages: new Set<CaseStage>(),
    subclasses: new Set<string>(),
    employerIds: new Set<string>(),
    referrerIds: new Set<string>(),
    activeOnly: false,
  })

  const today = useMemo(() => new Date(), [])

  // 递交进度行（两个 tab 共用）；归档客户的案件不显示
  const caseRows = useMemo(() => {
    const customerById: Record<string, unknown> = {}
    for (const c of customers.data ?? []) customerById[c.id] = c
    const visible = visibleCaseIds(cases.data ?? [], customerById)
    const visibleCases = (cases.data ?? []).filter((c) => visible.has(c.id))
    return selectCaseRows(
      visibleCases,
      lodgements.data ?? [],
      applicants.data ?? [],
      customers.data ?? [],
      today,
      stageHistory.data ?? [],
    )
  }, [cases.data, lodgements.data, applicants.data, customers.data, today, stageHistory.data])

  // 案件列表行（补雇主 / 大类 / 紧急）
  const listRows = useMemo(
    () =>
      selectCaseListRows(
        caseRows,
        cases.data ?? [],
        customers.data ?? [],
        employers.data ?? [],
        referrers.data ?? [],
      ),
    [caseRows, cases.data, customers.data, employers.data, referrers.data],
  )
  // 筛选项：阶段=全部；签证类别=只列已有案件的；雇主/介绍人=主数据全集
  const facets = useMemo(
    () => caseFilterFacets(listRows, employers.data ?? [], referrers.data ?? []),
    [listRows, employers.data, referrers.data],
  )
  const filteredList = useMemo(() => filterCaseListRows(listRows, filter), [listRows, filter])
  // 进度表按相同筛选：取筛选后命中的 caseId
  const allowedIds = useMemo(() => new Set(filteredList.map((r) => r.caseId)), [filteredList])
  const filteredCaseRows = useMemo(
    () => caseRows.filter((r) => allowedIds.has(r.caseId)),
    [caseRows, allowedIds],
  )
  // 案件列表按组聚类：同组案件相邻（组顺序跟随首行位置）
  const clusteredList = useMemo(() => clusterRowsByGroup(filteredList), [filteredList])

  const activeCount =
    filter.stages.size +
    filter.subclasses.size +
    filter.employerIds.size +
    filter.referrerIds.size +
    (filter.activeOnly ? 1 : 0)

  const isPending =
    lodgements.isPending || cases.isPending || customers.isPending || applicants.isPending ||
    stageHistory.isPending || tasks.isPending || employers.isPending || referrers.isPending
  const isError =
    lodgements.isError || cases.isError || customers.isError || applicants.isError ||
    stageHistory.isError || tasks.isError || employers.isError || referrers.isError

  if (isPending) return <LoadingBlock />
  if (isError) return <ErrorBlock error={new Error('案件数据加载失败，请刷新重试')} />

  function clearFilters() {
    setFilter((f) => ({
      ...f,
      stages: new Set(),
      subclasses: new Set(),
      employerIds: new Set(),
      referrerIds: new Set(),
      activeOnly: false,
    }))
  }

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">案件</h1>
        <p className="mt-0.5 text-sm text-muted">全部进行中案件 · 共 {listRows.length} 件</p>
      </div>

      {/* 段控 + 搜索 + 筛选 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex gap-1 rounded-full bg-surface-2 p-1">
          {(['list', 'lodge'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-full px-4 py-2 text-[13.5px] font-semibold transition-colors ${
                view === v ? 'bg-white text-brand shadow-xs' : 'text-muted hover:text-body'
              }`}
            >
              {v === 'list' ? '案件列表' : '递交进度'}
            </button>
          ))}
        </div>

        <div className="flex h-11 min-w-[220px] flex-1 items-center gap-2.5 rounded-full border border-line-2 bg-white px-4 text-faint shadow-xs focus-within:border-brand focus-within:ring-2 focus-within:ring-brand-100">
          <SearchIcon className="size-[18px] shrink-0" />
          <input
            type="search"
            value={filter.search}
            onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
            placeholder="搜索客户 / 签证类别 / 雇主 / 案件编号"
            className="h-full w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-faint"
          />
        </div>

        <FilterButton
          active={showFilters || activeCount > 0}
          count={activeCount}
          onClick={() => setShowFilters((s) => !s)}
        />
      </div>

      {/* 筛选面板：自由点选、随意组合（同维度「或」、跨维度「且」） */}
      {showFilters && (
        <Card className="space-y-3.5">
          <FilterGroup label="进度">
            <Chip
              active={filter.activeOnly}
              onClick={() => setFilter((f) => ({ ...f, activeOnly: !f.activeOnly }))}
            >
              只看进行中
            </Chip>
          </FilterGroup>

          {facets.stages.length > 0 && (
            <FilterGroup label="阶段">
              {facets.stages.map((s) => (
                <Chip
                  key={s}
                  active={filter.stages.has(s)}
                  onClick={() => setFilter((f) => ({ ...f, stages: toggle(f.stages, s) }))}
                >
                  {CASE_STAGE_LABELS[s]}
                </Chip>
              ))}
            </FilterGroup>
          )}

          {facets.subclasses.length > 0 && (
            <FilterGroup label="签证类别">
              {facets.subclasses.map((sc) => (
                <Chip
                  key={sc}
                  active={filter.subclasses.has(sc)}
                  onClick={() => setFilter((f) => ({ ...f, subclasses: toggle(f.subclasses, sc) }))}
                >
                  {sc}
                </Chip>
              ))}
            </FilterGroup>
          )}

          {facets.employers.length > 0 && (
            <FilterGroup label="担保雇主">
              {facets.employers.map((e) => (
                <Chip
                  key={e.id}
                  active={filter.employerIds.has(e.id)}
                  onClick={() => setFilter((f) => ({ ...f, employerIds: toggle(f.employerIds, e.id) }))}
                >
                  {e.name}
                </Chip>
              ))}
            </FilterGroup>
          )}

          {facets.referrers.length > 0 && (
            <FilterGroup label="介绍人">
              {facets.referrers.map((r) => (
                <Chip
                  key={r.id}
                  active={filter.referrerIds.has(r.id)}
                  onClick={() => setFilter((f) => ({ ...f, referrerIds: toggle(f.referrerIds, r.id) }))}
                >
                  {r.name}
                </Chip>
              ))}
            </FilterGroup>
          )}

          {activeCount > 0 && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={clearFilters}
                className="text-[13px] font-semibold text-muted hover:text-brand"
              >
                清除筛选
              </button>
            </div>
          )}
        </Card>
      )}

      {/* 内容 */}
      {view === 'lodge' ? (
        <LodgementProgressTable rows={filteredCaseRows} tasks={tasks.data ?? []} />
      ) : filteredList.length === 0 ? (
        <EmptyState
          title={listRows.length === 0 ? '还没有案件' : '没有匹配的案件'}
          icon={listRows.length === 0 ? '📁' : '🔍'}
          action={
            listRows.length === 0 ? (
              <Link
                to="/customers"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand px-5 text-sm font-semibold text-white shadow-brand hover:bg-brand-600"
              >
                去客户档案新建案件
              </Link>
            ) : undefined
          }
        />
      ) : (
        <CaseListTable rows={clusteredList} onOpen={(id) => navigate(`/cases/${id}`, { state: { from: 'cases', view: 'list' } })} />
      )}
    </section>
  )
}

/** 每个参与人名最长显示 5 个字，超出截断（title 提示全名）。 */
const clipName = (s: string) => (s.length > 5 ? s.slice(0, 5) + '…' : s)
const clipNames = (label: string) => label.split('、').map(clipName).join('、')

/** 案件列表表格：参与人 / 签证类别 / 担保雇主 / 当前阶段(🔴紧急) / 最近更新。同组案件相邻，组上方一条「组小节头行」（Group chip + 件数）；整行可点进详情。 */
function CaseListTable({ rows, onOpen }: { rows: CaseListRow[]; onOpen: (caseId: string) => void }) {
  const source = useBackSource()
  // 每行在组段中的位置：组首行上方插组小节头行
  const positions = groupPositions(rows)
  const td = 'border-b border-line px-4 py-3'
  return (
    <Card pad={false}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left text-[11px] font-bold tracking-[0.04em] text-faint uppercase">
              <th className="border-b border-line-2 px-4 py-3 whitespace-nowrap">参与人</th>
              <th className="border-b border-line-2 px-4 py-3 whitespace-nowrap">签证类别</th>
              <th className="border-b border-line-2 px-4 py-3 whitespace-nowrap">担保雇主</th>
              <th className="border-b border-line-2 px-4 py-3 whitespace-nowrap">当前阶段</th>
              <th className="border-b border-line-2 px-4 py-3 whitespace-nowrap">最近更新</th>
              <th className="border-b border-line-2 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const pos = positions[i]
              return (
              <Fragment key={r.caseId}>
              {/* 组小节头行：浅底细行 = Group chip（点击进同组管理）+ 件数 */}
              {pos.start && (
                <tr>
                  <td colSpan={6} className="border-b border-line bg-surface-2 px-4 py-1.5">
                    <span className="flex items-center gap-2">
                      {/* 一案一组：组码由本案参与人集合派生；同参与人集合的案件共用一个组头 */}
                      <span
                        title="同参与人的案件为一组"
                        className="rounded-full bg-[var(--color-lime-soft)] px-2.5 py-0.5 text-[12px] font-semibold text-[var(--color-lime-ink)]"
                      >
                        {r.groupCode}
                      </span>
                      <span className="text-[12px] text-faint">· {pos.span ?? 1} 件</span>
                    </span>
                  </td>
                </tr>
              )}
              <tr
                onClick={() => onOpen(r.caseId)}
                className="group cursor-pointer"
              >
                <td className={`${td} group-hover:bg-surface-2`}>
                  {/* 头像 + 名字 → 客户主页（stopPropagation 不触发行的案件跳转） */}
                  <Link
                    to={`/customers/${r.customerId}`}
                    state={source}
                    onClick={(e) => e.stopPropagation()}
                    title={r.participantsLabel || '客户'}
                    className="group/cust -m-1 flex items-center gap-3 rounded-lg p-1 transition hover:bg-white/70"
                  >
                    <Avatar name={r.customerName} seed={r.customerId} size={36} />
                    <span className="min-w-0">
                      <span className="block font-semibold text-ink group-hover/cust:text-brand">
                        {r.participantsLabel ? clipNames(r.participantsLabel) : '—'}
                      </span>
                      {r.stream && <span className="block text-xs text-faint">{r.stream}</span>}
                    </span>
                  </Link>
                </td>
                <td className={`${td} whitespace-nowrap group-hover:bg-surface-2`}>
                  <span className="font-bold text-body">{r.visaSubclass}</span>
                  {r.visaCategory && <span className="ml-1.5 text-[12.5px] text-muted">{r.visaCategory}</span>}
                </td>
                <td className={`${td} whitespace-nowrap text-muted group-hover:bg-surface-2`}>
                  {r.employerName || <span className="text-slate-300">—</span>}
                </td>
                <td className={`${td} whitespace-nowrap group-hover:bg-surface-2`}>
                  <span className="flex items-center gap-1.5">
                    {r.urgent && (
                      <span title="递交已超过移民局预估处理时长，需跟进" className="text-[13px] leading-none">
                        🔴
                      </span>
                    )}
                    <StageBadge stage={r.stage} />
                  </span>
                </td>
                <td className={`${td} whitespace-nowrap tabular-nums text-faint group-hover:bg-surface-2`}>
                  {r.updatedAt ? r.updatedAt.slice(0, 10) : '—'}
                </td>
                <td className={`${td} text-right group-hover:bg-surface-2`}>
                  <ChevronRightIcon className="inline size-4 text-slate-300" />
                </td>
              </tr>
              </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
