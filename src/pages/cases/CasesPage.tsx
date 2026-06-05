import { useMemo, useState } from 'react'
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
import { LodgementProgressTable } from '../../components/cases/LodgementProgressTable'
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
    employerIds: new Set<string>(),
    referrerIds: new Set<string>(),
    activeOnly: false,
  })

  const today = useMemo(() => new Date(), [])

  // 递交进度行（两个 tab 共用）；全员归档的案件才隐藏（任一参与人在册即可见）
  const caseRows = useMemo(() => {
    const customerById: Record<string, unknown> = {}
    for (const c of customers.data ?? []) customerById[c.id] = c
    const visible = visibleCaseIds(cases.data ?? [], customerById, applicants.data ?? [])
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
        <h1 className="font-serif text-[26px] font-bold tracking-[-0.01em] text-ink">递交进度</h1>
        <p className="mt-0.5 text-sm font-medium text-muted">全部案件审理跟踪 · 共 {listRows.length} 件 · 点行进客户档案</p>
      </div>

      {/* 搜索 + 筛选 */}
      <div className="flex flex-wrap items-center gap-3">
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

      {/* 内容：递交进度表（行点击 → 客户详情并选中该案） */}
      <LodgementProgressTable rows={filteredCaseRows} tasks={tasks.data ?? []} />
    </section>
  )
}
