import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useDashboard } from '../hooks/queries/useDashboard'
import { useChecklistView } from '../hooks/queries/useChecklistView'
import { useAuth } from '../hooks/useAuth'
import { useBackSource } from '../hooks/useBackSource'
import { LoadingBlock, ErrorBlock } from '../components/ui/states'
import { ClientSourceDot } from '../components/customers/ClientSourceDot'
import { ChecklistCard } from '../components/dashboard/ChecklistCard'
import { AlertCard } from '../components/dashboard/cards'
import { StatCard } from '../components/dashboard/StatCard'
import { Donut } from '../components/dashboard/Donut'
import { BarChart } from '../components/dashboard/BarChart'
import { Card, CardHead } from '../components/ui/Card'
import { Pill } from '../components/ui/Pill'
import { Well } from '../components/ui/Well'
import { NameCell } from '../components/ui/NameCell'
import { Avatar } from '../components/ui/Avatar'
import {
  AlertCircleIcon,
  BanknoteIcon,
  BellIcon,
  BriefcaseIcon,
  ChevronRightIcon,
  ClipboardIcon,
  ClockIcon,
  DocIcon,
  PassportIcon,
  PlusIcon,
  SearchIcon,
  ShieldIcon,
} from '../components/ui/icons'
import { CUSTOMER_PAYMENT_TEXT_CLASS } from '../lib/finance'
import { displayCustomerName, pickGreetingName, showReceiptsTrend } from '../lib/dashboardView'
import { formatMoney } from '../lib/money'
import type { ExpiringDocItem } from '../lib/dashboard'
import type { CaseStage } from '../types/domain'

/** DHA 官方签证处理时间页（全球） */
const VISA_PROCESSING_TIMES_URL =
  'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-processing-times/global-visa-processing-times'

/** 终态阶段（不计入「在办」）。 */
const TERMINAL_STAGES: ReadonlySet<CaseStage> = new Set<CaseStage>(['granted', 'refused', 'withdrawn'])

/** 顶部主按钮（亮蓝胶囊）。 */
function PrimaryLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex h-[46px] items-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-white shadow-brand transition-colors hover:bg-brand-600"
    >
      {children}
    </Link>
  )
}

/** 即将到期行的图标井映射。 */
const EXPIRY_ICON: Record<ExpiringDocItem['ic'], ReactNode> = {
  clock: <ClockIcon className="size-[22px]" />,
  passport: <PassportIcon className="size-[22px]" />,
  doc: <DocIcon className="size-[22px]" />,
}

/** 保留区：头像行（可点）。name 走无名兜底（可传更有意义的 fallback）。 */
function PersonRow({
  to,
  state,
  name,
  fallback,
  seed,
  meta,
  right,
}: {
  to: string
  state?: unknown
  name: string
  fallback?: string
  seed?: string
  meta?: ReactNode
  right?: ReactNode
}) {
  const display = displayCustomerName(name, fallback)
  return (
    <Link
      to={to}
      state={state}
      className="flex items-center gap-3 border-t border-line py-3 transition-opacity first:border-t-0 hover:opacity-70"
    >
      <Avatar name={display} seed={seed} size={38} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-semibold text-ink">{display}</div>
        {meta != null && <div className="truncate text-[11.5px] text-faint">{meta}</div>}
      </div>
      {right != null && <span className="shrink-0">{right}</span>}
    </Link>
  )
}

const DAY_TONE = {
  rose: 'bg-rose-50 text-rose-600',
  amber: 'bg-amber-50 text-amber-700',
  brand: 'bg-brand-50 text-brand',
} as const

function DayPill({ tone, children }: { tone: keyof typeof DAY_TONE; children: ReactNode }) {
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${DAY_TONE[tone]}`}>
      {children}
    </span>
  )
}

/** 右上「全部 ›」链接。 */
function MoreLink({ to, label = '全部' }: { to: string; label?: string }) {
  return (
    <Link to={to} className="flex items-center gap-0.5 text-[13px] font-semibold text-brand hover:text-brand-600">
      {label} <ChevronRightIcon className="size-3.5" />
    </Link>
  )
}

export function DashboardPage() {
  const d = useDashboard()
  const { profile } = useAuth()
  const checklist = useChecklistView()
  const source = useBackSource()
  const greetName = pickGreetingName(profile?.full_name)

  if (d.isPending) return <LoadingBlock />
  if (d.isError) return <ErrorBlock error={new Error('部分概览数据加载失败，请刷新重试')} />

  // 待办 = 待办清单未完成条数（已按归档隐藏过滤；与清单卡一致）
  const checklistOpen = checklist.openCount
  const showTrend = showReceiptsTrend(d.thisMonthReceipts, d.receiptsMoM)

  // 阶段分布：在办（不含终态）入环，下签单列为「已完成」图例
  const activeStages = d.stageDistribution.filter((s) => !TERMINAL_STAGES.has(s.stage))
  const grantedDatum = d.stageDistribution.find((s) => s.stage === 'granted')
  const grantedM = grantedDatum?.count ?? 0

  return (
    <div className="-mx-4 -mt-4 -mb-24 min-h-full bg-canvas px-4 pt-5 pb-24 md:-mx-8 md:-mt-6 md:-mb-8 md:px-8 md:pt-6 md:pb-10">
      <div className="space-y-5">
        {/* ① 顶部问候栏 */}
        <header className="flex flex-wrap items-center gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-[23px] font-bold tracking-[-0.02em] text-ink">
              你好{greetName && <>，{greetName}</>} <span className="ml-0.5">👋</span>
            </h1>
            <p className="mt-[5px] text-[13.5px] text-muted">
              待办 <span className="font-semibold tabular-nums text-body">{checklistOpen}</span> 条、
              临近到期 <span className="font-semibold tabular-nums text-body">{d.expiringDocItems.length}</span> 个
              <span className="mx-1.5 text-line-2">·</span>
              本月已收款 <span className="font-semibold tabular-nums text-emerald-600">{formatMoney(d.thisMonthReceipts)}</span>
            </p>
          </div>
          <Link
            to="/customers"
            className="hidden h-[46px] w-[248px] items-center gap-2.5 rounded-full border border-line-2 bg-white px-4 text-sm text-faint shadow-xs md:flex"
          >
            <SearchIcon className="size-[18px]" /> 搜索客户 / 案件 / 参考号
          </Link>
          <button
            type="button"
            className="relative grid size-[46px] place-items-center rounded-full border border-line-2 bg-white text-muted shadow-xs hover:text-ink"
            aria-label="通知"
          >
            <BellIcon className="size-5" />
            <span className="absolute top-[11px] right-3 size-2 rounded-full border-2 border-white bg-rose-500" />
          </button>
          <PrimaryLink to="/customers/new">
            <PlusIcon className="size-[18px]" /> 新建客户
          </PrimaryLink>
        </header>

        {/* ② 概览统计卡 ×4（金额统一 formatMoney） */}
        <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
          <StatCard icon={<BriefcaseIcon className="size-6" />} tone="brand" value={d.activeCaseCount} label="进行中案件" />
          <StatCard icon={<ClipboardIcon className="size-6" />} tone="sky" value={checklistOpen} label="待办事项" />
          <StatCard
            icon={<BanknoteIcon className="size-6" />}
            tone="emerald"
            value={formatMoney(d.thisMonthReceipts)}
            label="本月收款"
            trend={showTrend ? d.receiptsMoM : undefined}
          />
          <StatCard
            icon={<AlertCircleIcon className="size-6" />}
            tone="rose"
            value={formatMoney(d.debtTotals.clientOwesTotal)}
            label="客户欠款总额"
          />
        </div>

        {/* ③ 阶段环形图（在办 vs 下签）+ 待办阶段案件 */}
        <div className="grid gap-5 lg:grid-cols-[1.05fr_1fr]">
          <Card>
            <CardHead
              title="案件阶段分布"
              sub={`在办 ${d.activeCaseCount} · 已下签 ${grantedM}`}
              link={{ to: '/cases', label: '全部案件' }}
            />
            {activeStages.length === 0 ? (
              <p className="py-2 text-sm text-faint">暂无在办案件{grantedM > 0 ? `（已下签 ${grantedM}）` : ''}</p>
            ) : (
              <div className="flex flex-wrap items-center gap-[30px]">
                <Donut
                  data={activeStages.map((s) => ({ value: s.count, color: s.color }))}
                  center={d.activeCaseCount}
                  centerSub="在办案件"
                />
                <div className="flex min-w-[170px] flex-1 flex-col gap-3">
                  {activeStages.map((s) => (
                    <div key={s.stage} className="flex items-center gap-2.5 text-[13px]">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                      <span className="flex-1 text-body">{s.label}</span>
                      <span className="font-bold tabular-nums text-ink">{s.count}</span>
                    </div>
                  ))}
                  {grantedDatum && grantedM > 0 && (
                    <div className="flex items-center gap-2.5 text-[13px]">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: grantedDatum.color }} />
                      <span className="flex-1 text-body">
                        {grantedDatum.label}
                        <span className="font-medium text-faint"> · 已完成</span>
                      </span>
                      <span className="font-bold tabular-nums text-ink">{grantedM}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>

          <AlertCard
            title="待办阶段案件"
            sub="处于待办阶段的案件"
            count={d.todoCases.length}
            empty="暂无待办阶段案件"
            action={<MoreLink to="/cases" />}
          >
            <div>
              {d.todoCases.slice(0, 5).map((t) => (
                <Link
                  key={t.caseId}
                  to={`/customers/${t.customerId}?case=${t.caseId}`}
                  state={source}
                  className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0 hover:opacity-70"
                >
                  <NameCell name={displayCustomerName(t.customerName, `${t.visaLabel} · 案件`)} sub={t.visaLabel} seed={t.customerId} size={42} />
                  <div className="flex-1" />
                  <Pill tone="slate">待办</Pill>
                </Link>
              ))}
            </div>
          </AlertCard>
        </div>

        {/* ④ 即将到期 + 月度收款趋势 */}
        <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
          <Card>
            <CardHead title="即将到期提醒" sub="签证 / 文件 / TRT" />
            {d.expiringDocItems.length === 0 && d.trtReminders.length === 0 ? (
              <p className="py-2 text-sm text-faint">近 30 天无临近到期</p>
            ) : (
              <div>
                {d.expiringDocItems.map((e) => (
                  <Link
                    key={e.id}
                    to={`/customers/${e.customerId}`}
                    state={source}
                    className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0 hover:opacity-70"
                  >
                    <Well tone={e.tone === 'rose' ? 'rose' : 'amber'} size={42}>
                      {EXPIRY_ICON[e.ic]}
                    </Well>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-ink">{displayCustomerName(e.customerName)}</div>
                      <div className="truncate text-xs text-faint">{e.label}</div>
                    </div>
                    <DayPill tone={e.tone}>
                      {e.status === 'overdue' ? `逾期 ${-e.daysRemaining} 天` : `${e.daysRemaining} 天`}
                    </DayPill>
                  </Link>
                ))}
                {d.trtReminders.map((t) => (
                  <Link
                    key={t.caseId}
                    to={`/customers/${t.customerId}`}
                    state={source}
                    className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0 hover:opacity-70"
                  >
                    <Well tone="indigo" size={42}>
                      <ShieldIcon className="size-[22px]" />
                    </Well>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-ink">{displayCustomerName(t.customerName)}</div>
                      <div className="truncate text-xs text-faint">186 TRT 可办 · 下签 {t.monthsSinceGrant} 个月</div>
                    </div>
                    <Pill tone="indigo" dot={false}>可办理</Pill>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHead title="月度收款趋势" sub="近 6 个月 (AUD)" />
            <BarChart data={d.revenueSeries} />
          </Card>
        </div>

        {/* ⑤ 待办清单（合并 我的待办 + 清单）+ 欠款总览（按客户，上移） */}
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
          <ChecklistCard />

          <Card>
            <CardHead
              title="欠款总览"
              sub="按客户"
              action={
                <span className="text-right text-[12.5px] text-faint">
                  共欠你 <span className="font-bold tabular-nums text-rose-600">{formatMoney(d.debtTotals.clientOwesTotal)}</span>
                  <span className="mx-1">·</span>
                  欠主代理 <span className="font-bold tabular-nums text-amber-600">{formatMoney(d.debtTotals.companyOwesTotal)}</span>
                </span>
              }
            />
            {d.customerDebts.length === 0 ? (
              <p className="py-2 text-sm text-faint">无未结欠款</p>
            ) : (
              <ul>
                {d.customerDebts.map((c) => (
                  <li key={c.customerId} className="border-t border-line first:border-t-0">
                    <Link to={`/customers/${c.customerId}`} state={source} className="flex items-center gap-3 py-3 transition-opacity hover:opacity-70">
                      <Avatar name={displayCustomerName(c.customerName)} seed={c.customerId} size={38} />
                      <span
                        className={`min-w-0 flex-1 truncate text-[13.5px] font-semibold ${
                          c.color === 'default' ? 'text-ink' : CUSTOMER_PAYMENT_TEXT_CLASS[c.color]
                        }`}
                      >
                        {displayCustomerName(c.customerName)}
                      </span>
                      <span className="shrink-0 text-right">
                        {c.clientOwes > 0 && (
                          <span className="font-semibold tabular-nums text-rose-600">欠你 {formatMoney(c.clientOwes)}</span>
                        )}
                        {c.companyOwes > 0 && (
                          <span className="ml-2 text-xs tabular-nums text-amber-600">欠主代理 {formatMoney(c.companyOwes)}</span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* ⑥ 提醒与关注（紧凑三列，平衡密度）：逾期未付款 · 星标客户 · 官方处理时间 */}
        <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-2 lg:grid-cols-3">
          <AlertCard title="逾期未付款" count={d.overdueInstallments.length} empty="无逾期未付分期">
            {d.overdueInstallments.map((x) => (
              <PersonRow
                key={x.installmentId}
                to={`/customers/${x.customerId}?case=${x.caseId}`}
                state={source}
                name={x.customerName}
                seed={x.caseId}
                meta={<span className="tabular-nums">{formatMoney(x.amount)}</span>}
                right={<DayPill tone="rose">逾期 {x.daysOverdue} 天</DayPill>}
              />
            ))}
          </AlertCard>

          <AlertCard title="星标客户" count={d.priorityCustomers.length} empty="暂无标星客户">
            {d.priorityCustomers.map((c) => (
              <PersonRow
                key={c.id}
                to={`/customers/${c.id}`}
                state={source}
                name={c.full_name}
                seed={c.id}
                right={<ClientSourceDot source={c.client_source} />}
              />
            ))}
          </AlertCard>

          <a
            href={VISA_PROCESSING_TIMES_URL}
            target="_blank"
            rel="noreferrer"
            className="block rounded-card bg-white p-[22px] shadow-soft transition-colors hover:bg-brand-50/50"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-ink">官方签证处理时间</h2>
              <span className="text-brand">↗</span>
            </div>
            <p className="mt-1.5 text-sm text-muted">
              在 immi.homeaffairs.gov.au 查看全球签证处理时间（新标签打开）
            </p>
          </a>
        </div>

        {/* ⑦ 递交进度表 */}
        <Card className="!p-0">
          <div className="flex items-center justify-between px-[22px] pt-[22px] pb-3.5">
            <div>
              <h3 className="text-base font-bold text-ink">递交进度</h3>
              <div className="mt-[3px] text-[12.5px] text-faint">按递交时间排序</div>
            </div>
            <Link to="/cases" className="flex items-center gap-0.5 text-[13px] font-semibold text-brand hover:text-brand-600">
              打开案件表 <ChevronRightIcon className="size-3.5" />
            </Link>
          </div>
          {d.lodgementRows.length === 0 ? (
            <p className="px-[22px] pb-5 text-sm text-faint">暂无已递交的案件</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-[11px] font-bold tracking-[0.05em] text-faint uppercase">
                    <th className="px-3.5 pb-3.5 text-left">客户</th>
                    <th className="px-3.5 pb-3.5 text-left">签证类型</th>
                    <th className="px-3.5 pb-3.5 text-left">递交日期</th>
                    <th className="px-3.5 pb-3.5 text-left">状态</th>
                    <th className="w-[26%] px-3.5 pb-3.5 text-left">处理进度</th>
                    <th className="px-3.5 pb-3.5 text-right">至今</th>
                  </tr>
                </thead>
                <tbody>
                  {d.lodgementRows.map((l) => (
                    <tr key={l.id} className="border-t border-line hover:bg-surface-2">
                      <td className="px-3.5 py-3">
                        <NameCell name={displayCustomerName(l.name, l.visa)} seed={l.id} size={34} />
                      </td>
                      <td className="px-3.5 py-3 whitespace-nowrap text-muted">{l.visa}</td>
                      <td className="px-3.5 py-3 whitespace-nowrap tabular-nums text-faint">{l.date}</td>
                      <td className="px-3.5 py-3">
                        <Pill tone={l.statusTone}>{l.statusLabel}</Pill>
                      </td>
                      <td className="px-3.5 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="h-2 min-w-[96px] flex-1 overflow-hidden rounded-full bg-line-2">
                            <span
                              className="block h-full rounded-full"
                              style={{ width: `${l.percentElapsed}%`, background: l.barColor }}
                            />
                          </span>
                          <span
                            className={`whitespace-nowrap text-xs tabular-nums ${
                              l.statusTone === 'rose' ? 'text-rose-600' : 'text-faint'
                            }`}
                          >
                            {l.remainingText}
                          </span>
                        </div>
                      </td>
                      <td className="px-3.5 py-3 text-right whitespace-nowrap tabular-nums text-muted">{l.elapsedDays} 天</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
