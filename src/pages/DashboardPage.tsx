import type { ReactNode } from 'react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDashboard } from '../hooks/queries/useDashboard'
import { useUpdateRecord } from '../hooks/queries/useRecords'
import { LoadingBlock, ErrorBlock } from '../components/ui/states'
import { ClientSourceDot } from '../components/customers/ClientSourceDot'
import { CUSTOMER_PAYMENT_TEXT_CLASS } from '../lib/finance'
import { formatMoney } from '../lib/money'
import { isTaskOverdue } from '../lib/tasks'
import type { RecordRow } from '../types/models'

/** 我的待办里的内联截止日：点击 → 日历选择，选了即存（更新 records.due_date）。 */
function MyTaskDue({ task }: { task: RecordRow }) {
  const update = useUpdateRecord()
  const [editing, setEditing] = useState(false)
  const overdue = isTaskOverdue(task.due_date, task.is_done)
  if (editing) {
    return (
      <input
        type="date"
        autoFocus
        defaultValue={task.due_date ?? ''}
        onChange={(e) => {
          setEditing(false)
          update.mutate({ id: task.id, patch: { due_date: e.target.value || null } })
        }}
        onBlur={() => setEditing(false)}
        className="w-[8.5rem] rounded border border-indigo-300 px-1 py-0.5 text-xs outline-none"
      />
    )
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`shrink-0 text-xs font-medium ${overdue ? 'text-rose-600' : task.due_date ? 'text-amber-600' : 'text-slate-400'}`}
    >
      📅 {task.due_date ?? '设截止日'}
      {overdue ? ' · 逾期' : ''}
    </button>
  )
}

/** DHA 官方签证处理时间页（全球） */
const VISA_PROCESSING_TIMES_URL =
  'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-processing-times/global-visa-processing-times'

function AlertCard({
  title,
  count,
  children,
  empty,
}: {
  title: string
  count: number
  children: ReactNode
  empty: string
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {count > 0 && (
          <span className="rounded-full bg-indigo-100 px-2 text-xs font-medium text-indigo-700">
            {count}
          </span>
        )}
      </div>
      {count === 0 ? <p className="py-2 text-sm text-slate-400">{empty}</p> : children}
    </section>
  )
}

function Row({ to, left, right }: { to: string; left: ReactNode; right: ReactNode }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between gap-3 border-b border-slate-100 py-2.5 text-sm last:border-0 hover:opacity-70"
    >
      <span className="min-w-0 flex-1 truncate text-slate-900">{left}</span>
      <span className="shrink-0">{right}</span>
    </Link>
  )
}

export function DashboardPage() {
  const d = useDashboard()

  if (d.isPending) return <LoadingBlock />
  if (d.isError) return <ErrorBlock error={new Error('部分概览数据加载失败，请刷新重试')} />

  return (
    <section className="mx-auto max-w-5xl space-y-4">
      <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">概览</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* 我的待办：显示并链接关联客户名 */}
        <AlertCard title="我的待办" count={d.myOpenTasks.length} empty="暂无待办">
          {d.myOpenTasks.map((t) => {
            const customer = t.customer_id ? d.customerById[t.customer_id] : undefined
            return (
              <div
                key={t.id}
                className="flex items-center justify-between gap-3 border-b border-slate-100 py-2.5 text-sm last:border-0"
              >
                <span className="min-w-0 flex-1 truncate">
                  {customer && (
                    <>
                      <Link
                        to={`/customers/${customer.id}`}
                        className="font-medium text-indigo-600 hover:underline"
                      >
                        {customer.full_name}
                      </Link>
                      <span className="text-slate-400"> · </span>
                    </>
                  )}
                  <span className="text-slate-900">{t.content}</span>
                  {t.case_id && (
                    <Link
                      to={`/cases/${t.case_id}`}
                      className="ml-1.5 text-xs text-indigo-600 hover:underline"
                    >
                      案件 ›
                    </Link>
                  )}
                </span>
                <MyTaskDue task={t} />
              </div>
            )
          })}
        </AlertCard>

        {/* 官方签证处理时间（外链，替代原「临近决签」） */}
        <a
          href={VISA_PROCESSING_TIMES_URL}
          target="_blank"
          rel="noreferrer"
          className="block rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:bg-slate-50"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">官方签证处理时间</h2>
            <span className="text-slate-400">↗</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            在 immi.homeaffairs.gov.au 查看全球签证处理时间（新标签打开）
          </p>
        </a>

        {/* 逾期未付款 */}
        <AlertCard title="逾期未付款" count={d.overdueInstallments.length} empty="无逾期未付分期">
          {d.overdueInstallments.map((x) => (
            <Row
              key={x.installmentId}
              to={`/cases/${x.caseId}`}
              left={`${x.customerName} · ${formatMoney(x.amount)}`}
              right={<span className="text-xs font-medium text-rose-600">逾期 {x.daysOverdue} 天</span>}
            />
          ))}
        </AlertCard>

        {/* 待办客户清单：有未完成待办的客户 */}
        <AlertCard
          title="待办客户清单"
          count={d.customersWithOpenTasks.length}
          empty="暂无有待办的客户"
        >
          {d.customersWithOpenTasks.map((c) => (
            <Row
              key={c.customerId}
              to={`/customers/${c.customerId}`}
              left={c.customerName}
              right={<span className="text-xs font-medium text-slate-500">{c.openCount} 项待办</span>}
            />
          ))}
        </AlertCard>

        {/* 星标客户：is_starred = true 的客户 */}
        <AlertCard title="星标客户" count={d.priorityCustomers.length} empty="暂无标星客户">
          {d.priorityCustomers.map((c) => (
            <Row
              key={c.id}
              to={`/customers/${c.id}`}
              left={c.full_name}
              right={<ClientSourceDot source={c.client_source} />}
            />
          ))}
        </AlertCard>
      </div>

      {/* 欠款总览：按客户 */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">欠款总览（按客户）</h2>
          <span className="text-xs text-slate-400">
            客户共欠 <span className="font-medium text-rose-600">{formatMoney(d.debtTotals.clientOwesTotal)}</span>
            <span className="mx-1">·</span>
            共欠主代理 <span className="font-medium text-amber-600">{formatMoney(d.debtTotals.companyOwesTotal)}</span>
          </span>
        </div>

        {d.customerDebts.length === 0 ? (
          <p className="py-2 text-sm text-slate-400">无未结欠款</p>
        ) : (
          <ul>
            {d.customerDebts.map((c) => (
              <li key={c.customerId} className="border-b border-slate-100 last:border-0">
                <Link
                  to={`/customers/${c.customerId}`}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm hover:opacity-70"
                >
                  <span
                    className={`min-w-0 flex-1 truncate font-medium ${
                      c.color === 'default' ? 'text-slate-900' : CUSTOMER_PAYMENT_TEXT_CLASS[c.color]
                    }`}
                  >
                    {c.customerName}
                  </span>
                  <span className="shrink-0 text-right">
                    {c.clientOwes > 0 && (
                      <span className="font-medium text-rose-600">欠你 {formatMoney(c.clientOwes)}</span>
                    )}
                    {c.companyOwes > 0 && (
                      <span className="ml-2 text-xs text-amber-600">欠主代理 {formatMoney(c.companyOwes)}</span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  )
}
