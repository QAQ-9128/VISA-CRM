import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useCases } from '../../hooks/queries/useCases'
import { useCustomers } from '../../hooks/queries/useCustomers'
import { useOpenTasks } from '../../hooks/queries/useTasks'
import { StageBadge } from '../../components/cases/StageBadge'
import { LoadingBlock, ErrorBlock, EmptyState } from '../../components/ui/states'
import { selectCaseTasks, isTaskOverdue } from '../../lib/tasks'
import { formatVisaType } from '../../lib/visa'
import { visibleCaseIds } from '../../lib/visibility'
import { CASE_STAGES } from '../../types/domain'
import type { Case, Customer, Task } from '../../types/models'

const STAGE_ORDER: Record<string, number> = Object.fromEntries(CASE_STAGES.map((s, i) => [s, i]))

/** 全部案件列表：每案件一卡，显示阶段 + 最新 3 条待办。按阶段流程排序，组内最近更新在前。 */
export function CaseListPage() {
  const cases = useCases()
  const customers = useCustomers({})
  const tasks = useOpenTasks()

  const customerById = useMemo(() => {
    const m: Record<string, Customer> = {}
    for (const c of customers.data ?? []) m[c.id] = c
    return m
  }, [customers.data])

  const sorted = useMemo(() => {
    const visible = visibleCaseIds(cases.data ?? [], customerById)
    return (cases.data ?? [])
      .filter((c) => visible.has(c.id))
      .sort(
        (a, b) =>
          (STAGE_ORDER[a.current_stage] ?? 99) - (STAGE_ORDER[b.current_stage] ?? 99) ||
          b.updated_at.localeCompare(a.updated_at),
      )
  }, [cases.data, customerById])

  const isPending = cases.isPending || customers.isPending || tasks.isPending
  const isError = cases.isError || customers.isError || tasks.isError

  if (isPending) return <LoadingBlock />
  if (isError) return <ErrorBlock error={new Error('案件加载失败，请刷新重试')} />

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">全部案件</h1>
        <Link to="/cases/lodged" className="text-sm font-medium text-indigo-600 hover:underline">
          递交进度表 ↗
        </Link>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          title="还没有案件"
          action={
            <Link to="/customers" className="text-sm font-medium text-indigo-600 hover:underline">
              去客户档案新建案件
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {sorted.map((c) => (
            <CaseCard key={c.id} caseRow={c} customer={customerById[c.customer_id]} tasks={tasks.data ?? []} />
          ))}
        </ul>
      )}
    </section>
  )
}

function CaseCard({ caseRow: c, customer, tasks }: { caseRow: Case; customer?: Customer; tasks: Task[] }) {
  const caseTasks = useMemo(() => selectCaseTasks(tasks, c.id), [tasks, c.id])

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4">
      <Link to={`/cases/${c.id}`} className="flex items-start justify-between gap-3 hover:opacity-80">
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">{customer?.full_name ?? '（未知客户）'}</p>
          <p className="mt-0.5 text-sm text-slate-500">
            {formatVisaType(c.visa_subclass, c.visa_stream)} 签证 · {c.case_number}
          </p>
        </div>
        <StageBadge stage={c.current_stage} />
      </Link>

      <div className="mt-3 border-t border-slate-100 pt-3">
        <p className="mb-1.5 text-xs font-medium text-slate-400">待办</p>
        {caseTasks.length === 0 ? (
          <p className="text-sm text-slate-400">无</p>
        ) : (
          <ul className="space-y-1">
            {caseTasks.map((t) => {
              const overdue = isTaskOverdue(t.due_date, t.is_done)
              return (
                <li key={t.id}>
                  <Link
                    to={`/cases/${c.id}`}
                    className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50"
                  >
                    <span className={`truncate ${overdue ? 'font-medium text-rose-700' : 'text-slate-700'}`}>
                      {t.title}
                    </span>
                    <span
                      className={`shrink-0 tabular-nums ${overdue ? 'text-rose-600' : 'text-slate-400'}`}
                    >
                      {t.due_date ?? '无截止'}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </li>
  )
}
