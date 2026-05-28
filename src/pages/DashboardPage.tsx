import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useDashboard } from '../hooks/queries/useDashboard'
import { Badge } from '../components/ui/Badge'
import { LoadingBlock, ErrorBlock } from '../components/ui/states'
import { formatMoney } from '../lib/money'
import { isTaskOverdue } from '../lib/tasks'
import { CUSTOMER_TIER_LABELS, LODGEMENT_TYPE_LABELS } from '../types/domain'

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
        {/* 我的待办 */}
        <AlertCard title="我的待办（临近 / 逾期）" count={d.myOpenTasks.length} empty="没有临近或逾期的待办">
          {d.myOpenTasks.map((t) => {
            const overdue = isTaskOverdue(t.due_date, t.is_done)
            const to = t.case_id ? `/cases/${t.case_id}` : t.customer_id ? `/customers/${t.customer_id}` : '/'
            return (
              <Row
                key={t.id}
                to={to}
                left={t.title}
                right={
                  <span className={`text-xs font-medium ${overdue ? 'text-rose-600' : 'text-amber-600'}`}>
                    {t.due_date}
                    {overdue ? ' · 逾期' : ''}
                  </span>
                }
              />
            )
          })}
        </AlertCard>

        {/* 临近决签 */}
        <AlertCard title="临近决签（14 天内）" count={d.upcomingDecisions.length} empty="近期无临近决签的递交">
          {d.upcomingDecisions.map((x) => (
            <Row
              key={x.lodgementId}
              to={`/cases/${x.caseId}`}
              left={`${x.customerName} · ${x.visaSubclass} ${LODGEMENT_TYPE_LABELS[x.type]}`}
              right={
                <span className={`text-xs font-medium ${x.daysRemaining < 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                  {x.daysRemaining < 0 ? `已超期 ${-x.daysRemaining} 天` : `还剩 ${x.daysRemaining} 天`}
                </span>
              }
            />
          ))}
        </AlertCard>

        {/* 文件快过期 */}
        <AlertCard title="文件快过期（30 天内）" count={d.expiringDocuments.length} empty="近期无快过期文件">
          {d.expiringDocuments.map((x) => (
            <Row
              key={x.documentId}
              to={`/customers/${x.customerId}`}
              left={`${x.customerName} · ${x.label}`}
              right={
                <span className={`text-xs font-medium ${x.daysRemaining < 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                  {x.daysRemaining < 0 ? `已过期 ${-x.daysRemaining} 天` : `${x.daysRemaining} 天后到期`}
                </span>
              }
            />
          ))}
        </AlertCard>

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

        {/* 优先客户 */}
        <AlertCard title="优先客户" count={d.priorityCustomers.length} empty="暂无标星客户">
          {d.priorityCustomers.map((c) => (
            <Row
              key={c.id}
              to={`/customers/${c.id}`}
              left={c.full_name}
              right={c.priority_tier ? <Badge>{CUSTOMER_TIER_LABELS[c.priority_tier]}</Badge> : null}
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
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-900">{c.customerName}</span>
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
