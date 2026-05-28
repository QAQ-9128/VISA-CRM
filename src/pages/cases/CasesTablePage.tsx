import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLodgedLodgements } from '../../hooks/queries/useLodgements'
import { useCases } from '../../hooks/queries/useCases'
import { useCustomers } from '../../hooks/queries/useCustomers'
import { useAllCaseApplicants } from '../../hooks/queries/useCaseApplicants'
import { selectCaseRows, sortCaseRows } from '../../lib/casesTable'
import type { CaseRow, CaseSortKey } from '../../lib/casesTable'
import { visibleCaseIds } from '../../lib/visibility'
import { LoadingBlock, ErrorBlock, EmptyState } from '../../components/ui/states'

const fmtElapsed = (e: { months: number; days: number }) =>
  e.months <= 0 ? `${e.days} 天` : `${e.months} 个月 ${e.days} 天`

interface Column {
  key: CaseSortKey
  label: string
}
const COLUMNS: Column[] = [
  { key: 'caseNumber', label: '案件编号' },
  { key: 'primary', label: '主申请' },
  { key: 'secondary', label: '副申请' },
  { key: 'visa', label: '签证类型' },
  { key: 'nomDate', label: '提名递交时间' },
  { key: 'visaDate', label: '签证递交时间' },
  { key: 'elapsed', label: '距今多久' },
  { key: 'updated', label: '最新更新' },
]

export function CasesTablePage() {
  const lodgements = useLodgedLodgements()
  const cases = useCases()
  const customers = useCustomers({})
  const applicants = useAllCaseApplicants()

  const [sortKey, setSortKey] = useState<CaseSortKey>('elapsed')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const today = useMemo(() => new Date(), [])
  const rows = useMemo(() => {
    // 归档客户的案件不显示：只保留主申在册的案件
    const customerById: Record<string, unknown> = {}
    for (const c of customers.data ?? []) customerById[c.id] = c
    const visible = visibleCaseIds(cases.data ?? [], customerById)
    const visibleCases = (cases.data ?? []).filter((c) => visible.has(c.id))
    return selectCaseRows(visibleCases, lodgements.data ?? [], applicants.data ?? [], customers.data ?? [], today)
  }, [cases.data, lodgements.data, applicants.data, customers.data, today])
  const sorted = useMemo(() => sortCaseRows(rows, sortKey, sortDir), [rows, sortKey, sortDir])

  const isPending = lodgements.isPending || cases.isPending || customers.isPending || applicants.isPending
  const isError = lodgements.isError || cases.isError || customers.isError || applicants.isError

  function toggleSort(key: CaseSortKey) {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir(key === 'elapsed' || key === 'updated' ? 'desc' : 'asc')
    }
  }

  if (isPending) return <LoadingBlock />
  if (isError) return <ErrorBlock error={new Error('递交记录加载失败，请刷新重试')} />

  return (
    <section className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">递交进度</h1>
        <Link to="/cases/list" className="text-sm font-medium text-indigo-600 hover:underline">
          全部案件 ↗
        </Link>
      </div>

      {sorted.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="还没有已递交的案件"
            action={
              <Link to="/customers" className="text-sm font-medium text-indigo-600 hover:underline">
                去客户档案登记递交
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-4 -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <table className="w-full min-w-[56rem] border-collapse text-sm">
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
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <CaseRowView key={r.rowKey} row={r} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

const ROLE_LABEL: Record<string, string> = { merged: '合并', primary: '主申', secondary: '副申' }
const ROLE_TAG: Record<string, string> = {
  merged: 'bg-slate-100 text-slate-600',
  primary: 'bg-blue-100 text-blue-700',
  secondary: 'bg-violet-100 text-violet-700',
}

function CaseRowView({ row }: { row: CaseRow }) {
  const isSub = row.role === 'secondary'
  return (
    <tr className={`border-b border-slate-100 align-top hover:bg-slate-50/60 ${isSub ? 'bg-slate-50/40' : ''}`}>
      <td className={`py-2.5 pr-4 whitespace-nowrap ${isSub ? 'pl-4' : ''}`}>
        <span className="flex items-center gap-1.5">
          {isSub && (
            <span className="select-none font-mono text-slate-300" aria-hidden>
              └─
            </span>
          )}
          <Link
            to={`/cases/${row.caseId}`}
            className={isSub ? 'text-slate-400 hover:underline' : 'font-medium text-indigo-600 hover:underline'}
          >
            {row.caseNumber}
          </Link>
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${ROLE_TAG[row.role]}`}>
            {ROLE_LABEL[row.role]}
          </span>
        </span>
      </td>
      <td className="py-2.5 pr-4 whitespace-nowrap text-slate-900">{row.primaryName || '—'}</td>
      <td className={`py-2.5 pr-4 ${isSub ? 'font-medium text-violet-700' : 'text-slate-700'}`}>
        {row.secondaryName || '—'}
      </td>
      <td className="py-2.5 pr-4 whitespace-nowrap text-slate-900">{row.visaLabel}</td>
      <td className="py-2.5 pr-4 whitespace-nowrap tabular-nums text-slate-700">{row.nomLodgedDate || '—'}</td>
      <td className="py-2.5 pr-4 whitespace-nowrap tabular-nums text-slate-700">{row.visaLodgedDate || '—'}</td>
      <td className="py-2.5 pr-4 whitespace-nowrap font-medium text-slate-900">{fmtElapsed(row.elapsed)}</td>
      <td className="py-2.5 pr-4 whitespace-nowrap tabular-nums text-slate-400">{row.updatedAt.slice(0, 10)}</td>
    </tr>
  )
}
