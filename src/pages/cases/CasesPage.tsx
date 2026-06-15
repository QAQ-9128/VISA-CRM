import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAllLodgements } from '../../hooks/queries/useLodgements'
import { useCases, useAllStageHistory } from '../../hooks/queries/useCases'
import { useCustomers } from '../../hooks/queries/useCustomers'
import { useAllCaseApplicants } from '../../hooks/queries/useCaseApplicants'
import { useOpenRecords } from '../../hooks/queries/useRecords'
import { useEmployers } from '../../hooks/queries/useEmployers'
import { useReferrers } from '../../hooks/queries/useReferrers'
import { selectCaseRows } from '../../lib/casesTable'
import {
  selectCaseListRows,
  filterCaseListRows,
  caseFilterFacets,
  type CaseListFilter,
} from '../../lib/casesList'
import { visibleCaseIds } from '../../lib/visibility'
import { CASE_STAGE_LABELS } from '../../types/domain'
import type { CaseStage } from '../../types/domain'
import type { Customer } from '../../types/models'
import { selectCaseCards } from '../../lib/caseBoard'
import { LodgementProgressTable } from '../../components/cases/LodgementProgressTable'
import { CaseBoard } from '../../components/cases/CaseBoard'
import { Card } from '../../components/ui/Card'
import { Chip, FilterButton, FilterGroup } from '../../components/ui/filters'
import { SearchIcon } from '../../components/ui/icons'
import { LoadingBlock, ErrorBlock } from '../../components/ui/states'

/** 切换 Set 里某个值（不可变）。 */
function toggle<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

/** 递交进度页（案件列表/案件详情页已删：案件功能全部在客户详情页，这里只留 Excel 式审理跟踪表）。 */
export function CasesPage() {
  const lodgements = useAllLodgements()
  const cases = useCases()
  const customers = useCustomers({})
  const applicants = useAllCaseApplicants()
  const stageHistory = useAllStageHistory()
  const tasks = useOpenRecords()
  const employers = useEmployers()
  const referrers = useReferrers()

  const [showFilters, setShowFilters] = useState(false)
  const [filter, setFilter] = useState<CaseListFilter>({
    search: '',
    stages: new Set<CaseStage>(),
    subclasses: new Set<string>(),
    categories: new Set<string>(),
    ownerIds: new Set<string>(),
    activeOnly: false,
  })

  // 视图：进度表(默认) / 看板；存进 URL（?view=board）→ 刷新/返回保持。进入页面默认进度表，行为不变
  const [searchParams, setSearchParams] = useSearchParams()
  const view: 'table' | 'board' = searchParams.get('view') === 'board' ? 'board' : 'table'
  const setView = (v: 'table' | 'board') =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (v === 'board') next.set('view', 'board')
        else next.delete('view')
        return next
      },
      { replace: true },
    )

  const today = useMemo(() => new Date(), [])

  // 在册客户 map + 可见案件（全员归档才隐藏）——进度表与看板共用同一套案件
  const customerById = useMemo(() => {
    const m: Record<string, Customer> = {}
    for (const c of customers.data ?? []) m[c.id] = c
    return m
  }, [customers.data])
  const visibleCases = useMemo(() => {
    const visible = visibleCaseIds(cases.data ?? [], customerById, applicants.data ?? [])
    return (cases.data ?? []).filter((c) => visible.has(c.id))
  }, [cases.data, customerById, applicants.data])

  // 递交进度行（进度表用）
  const caseRows = useMemo(
    () =>
      selectCaseRows(
        visibleCases,
        lodgements.data ?? [],
        applicants.data ?? [],
        customers.data ?? [],
        today,
        stageHistory.data ?? [],
      ),
    [visibleCases, lodgements.data, applicants.data, customers.data, today, stageHistory.data],
  )

  // 案件卡 VM（看板用），与进度表读同一批可见案件
  const employerNameById = useMemo(() => {
    const m: Record<string, string> = {}
    for (const e of employers.data ?? []) m[e.id] = e.name
    return m
  }, [employers.data])
  const caseCards = useMemo(
    () => selectCaseCards(visibleCases, customerById, applicants.data ?? [], employerNameById),
    [visibleCases, customerById, applicants.data, employerNameById],
  )

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
  // 筛选项：阶段=全部；案件类型/案件大类=只列已有案件的；客户归属人=现有归属值 distinct
  const facets = useMemo(() => caseFilterFacets(listRows), [listRows])
  const filteredList = useMemo(() => filterCaseListRows(listRows, filter), [listRows, filter])
  // 进度表按相同筛选：取筛选后命中的 caseId
  const allowedIds = useMemo(() => new Set(filteredList.map((r) => r.caseId)), [filteredList])
  const filteredCaseRows = useMemo(
    () => caseRows.filter((r) => allowedIds.has(r.caseId)),
    [caseRows, allowedIds],
  )
  // 看板呈现「同一筛选结果」：与进度表共用 allowedIds（避免两套筛选并存）
  const boardVms = useMemo(() => caseCards.filter((vm) => allowedIds.has(vm.caseId)), [caseCards, allowedIds])

  // 卡片「查看进度 →」：切到进度表并把搜索定位到该案件（复用现有搜索，不动表格本身）
  const jumpToCase = (caseId: string) => {
    const caseNumber = caseCards.find((c) => c.caseId === caseId)?.caseNumber ?? ''
    setFilter((f) => ({ ...f, search: caseNumber }))
    setView('table')
  }

  const activeCount =
    filter.stages.size +
    filter.subclasses.size +
    filter.categories.size +
    filter.ownerIds.size +
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
      categories: new Set(),
      ownerIds: new Set(),
      activeOnly: false,
    }))
  }

  return (
    <section className="space-y-4">
      <div>
        <h1 className="font-serif text-[26px] font-bold tracking-[-0.01em] text-ink">递交进度</h1>
        <p className="mt-0.5 text-sm font-medium text-muted">
          {view === 'board'
            ? `案件卡一览 · 共 ${boardVms.length} 件 · 点卡片「查看进度」回进度表定位`
            : `全部案件审理跟踪 · 共 ${listRows.length} 件 · 点行进客户档案`}
        </p>
      </div>

      {/* 视图段控 + 搜索 + 筛选（搜索/筛选两视图共用） */}
      <div className="flex flex-wrap items-center gap-3">
        {/* 进度表 / 看板 段控 */}
        <div className="inline-flex gap-1 rounded-full bg-surface-2 p-1">
          {(['table', 'board'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`inline-flex min-h-11 items-center rounded-full px-4 text-[13.5px] font-semibold transition-colors ${
                view === v ? 'bg-white text-brand shadow-xs' : 'text-muted hover:text-body'
              }`}
            >
              {v === 'table' ? '进度表' : '看板'}
            </button>
          ))}
        </div>

        <div className="flex h-11 min-w-[220px] flex-1 items-center gap-2.5 rounded-full border border-line-2 bg-white px-4 text-faint shadow-xs focus-within:border-brand focus-within:ring-2 focus-within:ring-brand-100">
          <SearchIcon className="size-[18px] shrink-0" />
          <input
            type="search"
            value={filter.search}
            onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
            placeholder="搜索客户 / 案件类型 / 案件大类 / 雇主 / 介绍人 / 归属人 / 案件编号"
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

          {/* 案件大类（cases.case_category 四值枚举）：只列已出现过的 */}
          {facets.categories.length > 0 && (
            <FilterGroup label="案件大类">
              {facets.categories.map((c) => (
                <Chip
                  key={c}
                  active={filter.categories.has(c)}
                  onClick={() => setFilter((f) => ({ ...f, categories: toggle(f.categories, c) }))}
                >
                  {c}
                </Chip>
              ))}
            </FilterGroup>
          )}

          {facets.subclasses.length > 0 && (
            <FilterGroup label="案件类型">
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

          {/* 客户归属人（customers.owner_referrer_id）：选项=现有归属值 distinct；替代旧的担保雇主/介绍人筛选 */}
          {facets.owners.length > 0 && (
            <FilterGroup label="客户归属人">
              {facets.owners.map((o) => (
                <Chip
                  key={o.id}
                  active={filter.ownerIds.has(o.id)}
                  onClick={() => setFilter((f) => ({ ...f, ownerIds: toggle(f.ownerIds, o.id) }))}
                >
                  {o.name}
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

      {/* 内容：进度表（不动）/ 案件 card 看板（读同一筛选结果） */}
      {view === 'board' ? (
        <CaseBoard vms={boardVms} onViewProgress={jumpToCase} />
      ) : (
        <LodgementProgressTable rows={filteredCaseRows} tasks={tasks.data ?? []} />
      )}
    </section>
  )
}
