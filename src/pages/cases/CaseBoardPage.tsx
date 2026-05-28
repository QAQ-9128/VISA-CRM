import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useCases } from '../../hooks/queries/useCases'
import { useCustomers } from '../../hooks/queries/useCustomers'
import { groupCasesByStage } from '../../lib/caseBoard'
import { CASE_STAGE_LABELS, CASE_STAGE_STYLES } from '../../types/domain'
import { LoadingBlock, ErrorBlock, EmptyState } from '../../components/ui/states'
import type { Case } from '../../types/models'

function CaseCard({ c, customerName }: { c: Case; customerName: string }) {
  return (
    <Link
      to={`/cases/${c.id}`}
      className="block rounded-lg border border-slate-200 bg-white p-3 transition-shadow hover:shadow-sm"
    >
      <p className="truncate font-medium text-slate-900">{customerName || '（未知客户）'}</p>
      <p className="mt-0.5 text-sm text-slate-500">
        {c.visa_subclass} 类签证
        {c.destination_country ? ` · ${c.destination_country}` : ''}
      </p>
    </Link>
  )
}

export function CaseBoardPage() {
  const cases = useCases()
  const customers = useCustomers({})

  const nameById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const c of customers.data ?? []) map[c.id] = c.full_name
    return map
  }, [customers.data])

  if (cases.isPending) return <LoadingBlock />
  if (cases.isError) return <ErrorBlock error={cases.error} />

  const columns = groupCasesByStage(cases.data)

  return (
    <section className="mx-auto max-w-6xl">
      <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">案件看板</h1>

      {cases.data.length === 0 ? (
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
        // 桌面：横向列可滚动；手机：纵向按阶段堆叠（空阶段在手机隐藏）
        <div className="mt-4 flex flex-col gap-4 md:flex-row md:overflow-x-auto md:pb-2">
          {columns.map((col) => {
            const empty = col.cases.length === 0
            return (
              <div key={col.stage} className={`md:w-72 md:shrink-0 ${empty ? 'hidden md:block' : ''}`}>
                <div className="mb-2 flex items-center justify-between">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CASE_STAGE_STYLES[col.stage]}`}>
                    {CASE_STAGE_LABELS[col.stage]}
                  </span>
                  <span className="text-xs text-slate-400">{col.cases.length}</span>
                </div>
                <div className="space-y-2">
                  {col.cases.map((c) => (
                    <CaseCard key={c.id} c={c} customerName={nameById[c.customer_id]} />
                  ))}
                  {empty && <p className="py-2 text-xs text-slate-300">（空）</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
