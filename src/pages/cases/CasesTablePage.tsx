import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAllLodgements } from '../../hooks/queries/useLodgements'
import { useCases, useAllStageHistory } from '../../hooks/queries/useCases'
import { useCustomers } from '../../hooks/queries/useCustomers'
import { useAllCaseApplicants } from '../../hooks/queries/useCaseApplicants'
import { useOpenRecords } from '../../hooks/queries/useRecords'
import { selectCaseRows, sortCaseRows } from '../../lib/casesTable'
import type { CaseRow, CaseSortKey } from '../../lib/casesTable'
import { selectCaseTodoPreviews } from '../../lib/tasks'
import { visibleCaseIds } from '../../lib/visibility'
import { StageBadge } from '../../components/cases/StageBadge'
import { LoadingBlock, ErrorBlock, EmptyState } from '../../components/ui/states'
import type { RecordRow } from '../../types/models'

const fmtElapsed = (e: { months: number; days: number }) =>
  e.months <= 0 ? `${e.days} 天` : `${e.months} 个月 ${e.days} 天`

/** 距今着色：已决冻结→灰；未决且超 DHA 处理天数→红；其余默认。 */
const waitClass = (frozen: boolean, daysSince: number | null, dhaDays: number | null) =>
  frozen
    ? 'text-slate-400'
    : daysSince != null && dhaDays != null && daysSince > dhaDays
      ? 'text-rose-600'
      : 'text-slate-900'

const truncate = (s: string, n = 30) => (s.length > n ? s.slice(0, n) + '…' : s)

interface Column {
  key: CaseSortKey
  label: string
}
const COLUMNS: Column[] = [
  { key: 'caseNumber', label: '案件编号' },
  { key: 'primary', label: '主申请' },
  { key: 'secondary', label: '副申请' },
  { key: 'visa', label: '签证类型' },
  { key: 'stage', label: '状态' },
  { key: 'nomDate', label: '提名递交时间' },
  { key: 'nomElapsed', label: '提名距今' },
  { key: 'visaDate', label: '签证递交时间' },
  { key: 'visaElapsed', label: '签证距今' },
]

export function CasesTablePage() {
  const lodgements = useAllLodgements()
  const cases = useCases()
  const customers = useCustomers({})
  const applicants = useAllCaseApplicants()
  const stageHistory = useAllStageHistory()
  const tasks = useOpenRecords()

  // 默认按「提名递交时间」倒序（最近递交在最上，未递交的排最下）
  const [sortKey, setSortKey] = useState<CaseSortKey>('nomDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const today = useMemo(() => new Date(), [])
  const rows = useMemo(() => {
    // 归档客户的案件不显示：只保留主申在册的案件
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
  const sorted = useMemo(() => sortCaseRows(rows, sortKey, sortDir), [rows, sortKey, sortDir])

  const isPending =
    lodgements.isPending || cases.isPending || customers.isPending || applicants.isPending || stageHistory.isPending || tasks.isPending
  const isError =
    lodgements.isError || cases.isError || customers.isError || applicants.isError || stageHistory.isError || tasks.isError

  function toggleSort(key: CaseSortKey) {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir(['nomDate', 'visaDate', 'nomElapsed', 'visaElapsed'].includes(key) ? 'desc' : 'asc')
    }
  }

  if (isPending) return <LoadingBlock />
  if (isError) return <ErrorBlock error={new Error('递交记录加载失败，请刷新重试')} />

  const allTasks = tasks.data ?? []

  return (
    <section className="mx-auto max-w-6xl">
      <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">递交进度</h1>

      {sorted.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="还没有案件"
            action={
              <Link to="/customers" className="text-sm font-medium text-indigo-600 hover:underline">
                去客户档案新建案件
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-4 -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <table className="w-full min-w-[64rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                {COLUMNS.map((col) => (
                  <th key={col.key} className="py-2 pr-4 font-medium whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      {col.label}
                      <span className="text-slate-400">
                        {sortKey === col.key ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                      </span>
                    </button>
                  </th>
                ))}
                <th className="py-2 pr-4 font-medium whitespace-nowrap">待办</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <CaseRowView key={r.rowKey} row={r} tasks={allTasks} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function CaseRowView({ row, tasks }: { row: CaseRow; tasks: RecordRow[] }) {
  const todos = selectCaseTodoPreviews(tasks, row.caseId)
  return (
    <tr className="border-b border-slate-100 align-top hover:bg-slate-50/60">
      <td className="py-2.5 pr-4 whitespace-nowrap">
        <Link to={`/cases/${row.caseId}`} state={{ from: 'cases' }} className="font-medium text-indigo-600 hover:underline">
          {row.caseNumber}
        </Link>
      </td>
      <td className="py-2.5 pr-4 whitespace-nowrap text-slate-900">{row.primaryName || '—'}</td>
      <td className="py-2.5 pr-4 text-slate-700">{row.secondaryName || '—'}</td>
      <td className="py-2.5 pr-4 whitespace-nowrap text-slate-900">{row.visaLabel}</td>
      <td className="py-2.5 pr-4 whitespace-nowrap">
        <StageBadge stage={row.currentStage} />
      </td>
      <td className="py-2.5 pr-4 whitespace-nowrap tabular-nums text-slate-700">{row.nomLodgedDate || '—'}</td>
      <td className={`py-2.5 pr-4 whitespace-nowrap font-medium ${waitClass(row.frozen, row.nomDaysSince, row.nomDhaDays)}`}>
        {row.nomElapsed ? fmtElapsed(row.nomElapsed) : <span className="text-slate-400">—</span>}
      </td>
      <td className="py-2.5 pr-4 whitespace-nowrap tabular-nums text-slate-700">{row.visaLodgedDate || '—'}</td>
      <td className={`py-2.5 pr-4 whitespace-nowrap font-medium ${waitClass(row.frozen, row.visaDaysSince, row.visaDhaDays)}`}>
        {row.visaElapsed ? fmtElapsed(row.visaElapsed) : <span className="text-slate-400">—</span>}
      </td>
      <td className="py-2.5 pr-4 min-w-[14rem]">
        {todos.length === 0 ? (
          <span className="text-slate-400">—</span>
        ) : (
          <ul className="space-y-0.5">
            {todos.map((t) => (
              <li key={t.id} className="text-sm text-slate-700" title={t.content}>
                <span className="mr-1">{t.emoji_marker || '📝'}</span>
                {truncate(t.content)}
              </li>
            ))}
          </ul>
        )}
      </td>
    </tr>
  )
}
