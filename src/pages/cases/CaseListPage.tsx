import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useArchiveCase, useCases } from '../../hooks/queries/useCases'
import { useCustomers } from '../../hooks/queries/useCustomers'
import { useOpenTaskRecords } from '../../hooks/queries/useRecords'
import { StageBadge } from '../../components/cases/StageBadge'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import { TrashIcon } from '../../components/ui/icons'
import { LoadingBlock, ErrorBlock, EmptyState } from '../../components/ui/states'
import { selectCaseTasks, isTaskOverdue } from '../../lib/tasks'
import { formatVisaType } from '../../lib/visa'
import { visibleCaseIds } from '../../lib/visibility'
import { CASE_STAGES } from '../../types/domain'
import type { Case, Customer, RecordRow } from '../../types/models'

const STAGE_ORDER: Record<string, number> = Object.fromEntries(CASE_STAGES.map((s, i) => [s, i]))

/** 全部案件列表：每案件一卡，显示阶段 + 最新 3 条待办。按阶段流程排序，组内最近更新在前。 */
export function CaseListPage() {
  const cases = useCases()
  const customers = useCustomers({})
  const tasks = useOpenTaskRecords()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)

  const customerById = useMemo(() => {
    const m: Record<string, Customer> = {}
    for (const c of customers.data ?? []) m[c.id] = c
    return m
  }, [customers.data])

  // 新建案件需挂到某客户（成为案件主申请人）；下拉列出全部在册客户
  const customerOptions = useMemo(
    () =>
      (customers.data ?? [])
        .map((c) => ({ value: c.id, label: c.full_name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [customers.data],
  )

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
        <div className="flex items-center gap-3">
          <Link to="/cases/lodged" className="text-sm font-medium text-indigo-600 hover:underline">
            递交进度表 ↗
          </Link>
          <Button variant="secondary" onClick={() => setCreating((v) => !v)}>
            + 新建案件
          </Button>
        </div>
      </div>

      {creating && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3">
          <div className="min-w-[14rem] flex-1">
            <Select
              label="选择客户（案件挂靠的主申请人）"
              placeholder="选择客户后新建案件…"
              options={customerOptions}
              value=""
              onChange={(e) => {
                if (e.target.value) navigate(`/cases/new?customer=${e.target.value}`)
              }}
            />
          </div>
          <p className="pb-2 text-xs text-slate-400">案件须挂在某客户下；也可到客户档案页「+ 新建案件」。</p>
        </div>
      )}

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

function CaseCard({ caseRow: c, customer, tasks }: { caseRow: Case; customer?: Customer; tasks: RecordRow[] }) {
  const caseTasks = useMemo(() => selectCaseTasks(tasks, c.id), [tasks, c.id])
  const archive = useArchiveCase()

  function handleDelete() {
    const label = `${formatVisaType(c.visa_subclass, c.visa_stream)} 签证`
    if (!window.confirm(`确认删除案件「${label}」？归档后从列表消失，可随时恢复。`)) return
    archive.mutate(c.id)
  }

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <Link to={`/cases/${c.id}`} className="min-w-0 flex-1 hover:opacity-80">
          <p className="truncate font-medium text-slate-900">{customer?.full_name ?? '（未知客户）'}</p>
          <p className="mt-0.5 text-sm text-slate-500">
            {formatVisaType(c.visa_subclass, c.visa_stream)} 签证 · {c.case_number}
          </p>
        </Link>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <StageBadge stage={c.current_stage} />
          <button
            type="button"
            title="删除案件（软删，可恢复）"
            aria-label="删除案件"
            disabled={archive.isPending}
            onClick={handleDelete}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-rose-600 disabled:opacity-50"
          >
            <TrashIcon className="size-4" />
            删除
          </button>
        </div>
      </div>

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
                      {t.content}
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
