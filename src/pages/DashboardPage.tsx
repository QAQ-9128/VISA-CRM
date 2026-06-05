import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDashboard } from '../hooks/queries/useDashboard'
import { useChecklistView } from '../hooks/queries/useChecklistView'
import { useAuth } from '../hooks/useAuth'
import { useBackSource } from '../hooks/useBackSource'
import { LoadingBlock, ErrorBlock } from '../components/ui/states'
import { ChecklistCard } from '../components/dashboard/ChecklistCard'
import { Donut } from '../components/dashboard/Donut'
import { Avatar } from '../components/ui/Avatar'
import {
  AlertCircleIcon,
  BanknoteIcon,
  BriefcaseIcon,
  ClipboardIcon,
} from '../components/ui/icons'
import { CUSTOMER_PAYMENT_TEXT_CLASS } from '../lib/finance'
import { countOwingCustomers, displayCustomerName, pickGreetingName } from '../lib/dashboardView'
import { formatAmount, formatMoney } from '../lib/money'
import type { CaseStage } from '../types/domain'

/*
 * 概览（mockup「精简案件优先」1:1）：精简到 5 块——
 * ① Header（衬线问候 + 摘要 + 搜索/铃/新建客户）② KPI 四卡 ③ 案件进度区（阶段环图 + 待办阶段案件）
 * ④ 待办清单（含临近到期浅绿条）+ 欠款总览（逾期分期折进底行）⑤ 官方签证处理时间。
 * 纯展示页：全部数字来自 useDashboard / useChecklistView 现有派生，本页零聚合。
 * mockup 色对应：green-d=emerald-700 · green-deep=brand-700 · green-bg=emerald-50 · coral-d=#c25a52
 *               coral-bg=rose-50 · line2=surface-2 · blue/blue-bg=#3f7cb5/#e6edf7（无令牌，按图取值）
 */

/** DHA 官方签证处理时间页（全球） */
const VISA_PROCESSING_TIMES_URL =
  'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-processing-times/global-visa-processing-times'

/** 终态阶段（不计入「在办」；环图只收在办 + 已下签）。 */
const TERMINAL_STAGES: ReadonlySet<CaseStage> = new Set<CaseStage>(['granted', 'refused', 'withdrawn'])

const CARD = 'rounded-[20px] bg-white [box-shadow:0_14px_34px_-20px_rgba(40,90,60,.22)]'
const CORAL_D = 'text-[#c25a52]'

/** KPI 卡（mockup .kpi）：图标井 + 大数 + 标签，右上可选珊瑚角标。整卡可点（to=跳页 / scrollTo=滚到本页区块）。 */
function Kpi({
  icon,
  iconClass,
  value,
  valueClass = 'text-ink',
  label,
  badge,
  to,
  scrollTo,
}: {
  icon: ReactNode
  iconClass: string
  value: ReactNode
  valueClass?: string
  label: string
  badge?: string
  /** 点击跳转的路由（如 /cases） */
  to?: string
  /** 点击滚到本页的元素 id（如 checklist / debts） */
  scrollTo?: string
}) {
  const body = (
    <>
      {badge && (
        <span className={`absolute top-[18px] right-[18px] rounded-[7px] bg-rose-50 px-2 py-[2px] text-[11px] font-semibold ${CORAL_D}`}>
          {badge}
        </span>
      )}
      <span className={`mb-3 grid size-[38px] place-items-center rounded-[11px] text-[17px] ${iconClass}`}>{icon}</span>
      <div className={`text-[27px] font-bold tracking-[.2px] tabular-nums ${valueClass}`}>{value}</div>
      <div className="mt-1 text-[12.5px] text-muted">{label}</div>
    </>
  )
  const cls = `relative block w-full p-[18px_20px] text-left transition-transform hover:-translate-y-0.5 active:translate-y-0 ${CARD}`
  if (to) {
    return (
      <Link to={to} className={cls} aria-label={`${label}，查看详情`}>
        {body}
      </Link>
    )
  }
  return (
    <button
      type="button"
      onClick={() => scrollTo && document.getElementById(scrollTo)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
      className={cls}
      aria-label={`${label}，定位到对应区块`}
    >
      {body}
    </button>
  )
}

/** KPI 金额：AUD 小前缀 + 数字（mockup .val .ccy）。 */
function Money({ amount }: { amount: number }) {
  return (
    <>
      <span className="mr-[3px] text-[13px] font-semibold text-faint">AUD</span>
      {formatAmount(amount)}
    </>
  )
}

/** 卡头（mockup .ch）：标题 16px + 小字/计数 + 右侧「全部 ›」。 */
function Ch({
  title,
  small,
  count,
  more,
}: {
  title: string
  small?: string
  count?: number
  more?: { to: string; label: string }
}) {
  return (
    <div className="flex items-center justify-between px-[22px] pt-[18px] pb-1">
      <h2 className="text-base font-semibold text-ink">
        {title}
        {small && <small className="ml-[9px] text-[11.5px] font-normal text-faint">{small}</small>}
        {count != null && count > 0 && (
          <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-[7px] bg-emerald-50 px-1.5 align-[2px] text-[11.5px] font-semibold tabular-nums text-emerald-700">
            {count}
          </span>
        )}
      </h2>
      {more && (
        <Link to={more.to} className="text-[12.5px] font-medium text-emerald-700 hover:underline">
          {more.label} ›
        </Link>
      )}
    </div>
  )
}

export function DashboardPage() {
  const d = useDashboard()
  const { profile } = useAuth()
  const checklist = useChecklistView()
  const source = useBackSource()
  const navigate = useNavigate()
  const greetName = pickGreetingName(profile?.full_name)

  if (d.isPending) return <LoadingBlock />
  if (d.isError) return <ErrorBlock error={new Error('部分概览数据加载失败，请刷新重试')} />

  // 待办 = 待办清单未完成条数（与清单卡一致）；临近到期 = 文档/签证 + TRT
  const checklistOpen = checklist.openCount
  const dueCount = d.expiringDocItems.length + d.trtReminders.length

  // 阶段分布：在办（不含终态）+ 已下签入环；环心 = 在办数
  const activeStages = d.stageDistribution.filter((s) => !TERMINAL_STAGES.has(s.stage))
  const grantedDatum = d.stageDistribution.find((s) => s.stage === 'granted')
  const grantedN = grantedDatum?.count ?? 0
  const ringStages = grantedDatum && grantedN > 0 ? [...activeStages, grantedDatum] : activeStages

  const owingCount = countOwingCustomers(d.customerDebts)

  // 临近到期浅绿条（mockup .duegrp）：空 = 单行文案；有 = 头行 + 逐条可点
  const dueStrip = (
    <div className="mx-[22px] mt-0.5 mb-1.5 rounded-[11px] border border-[#e3eecb] bg-[#eef7d6] px-[13px] py-[9px] text-[12.5px] text-[#7d9e36]">
      {dueCount === 0 ? (
        <span>⏰ 临近到期（签证 / 文件 / TRT）：近 30 天无临近到期</span>
      ) : (
        <>
          <span className="font-semibold">⏰ 临近到期（签证 / 文件 / TRT）</span>
          <ul className="mt-1 space-y-0.5">
            {d.expiringDocItems.map((e) => (
              <li key={e.id}>
                <Link to={`/customers/${e.customerId}`} state={source} className="hover:underline">
                  {displayCustomerName(e.customerName)} · {e.label}
                  {e.status === 'overdue' ? `（逾期 ${-e.daysRemaining} 天）` : ''}
                </Link>
              </li>
            ))}
            {d.trtReminders.map((t) => (
              <li key={t.caseId}>
                <Link to={`/customers/${t.customerId}`} state={source} className="hover:underline">
                  {displayCustomerName(t.customerName)} · 186 TRT 可办 · 下签 {t.monthsSinceGrant} 个月
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      {/* ── ① Header ─────────────────────────────────────────────── */}
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-[27px] font-semibold text-ink">
            你好{greetName && <>，{greetName}</>} <span aria-hidden>👋</span>
          </h1>
          <p className="mt-1.5 text-[13.5px] text-muted">
            待办 <b className="font-semibold tabular-nums text-emerald-700">{checklistOpen}</b> 条 ·
            临近到期 <b className="font-semibold tabular-nums text-emerald-700">{dueCount}</b> 个 ·
            本月已收 <b className="font-semibold tabular-nums text-emerald-700">{formatMoney(d.thisMonthReceipts)}</b>
          </p>
        </div>
        <Link
          to="/customers/new"
          className="rounded-[13px] bg-[linear-gradient(135deg,#2e6a48,#357a52)] px-5 py-3 text-sm font-semibold text-white [box-shadow:0_10px_24px_-12px_rgba(46,106,72,.6)]"
        >
          ＋ 新建客户
        </Link>
      </header>

      {/* ── ② KPI 四卡 ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-[15px] lg:grid-cols-4">
        <Kpi
          icon={<BriefcaseIcon className="size-[19px]" />}
          iconClass="bg-emerald-50 text-emerald-700"
          value={d.activeCaseCount}
          valueClass="text-brand-700"
          label="进行中案件"
          to="/cases"
        />
        <Kpi
          icon={<ClipboardIcon className="size-[19px]" />}
          iconClass="bg-[#e6edf7] text-[#3f7cb5]"
          value={checklistOpen}
          label="待办事项"
          scrollTo="checklist"
        />
        <Kpi
          icon={<BanknoteIcon className="size-[19px]" />}
          iconClass="bg-emerald-50 text-emerald-700"
          value={<Money amount={d.thisMonthReceipts} />}
          valueClass="text-emerald-700"
          label="本月收款"
          to="/finance"
        />
        <Kpi
          icon={<AlertCircleIcon className="size-[19px]" />}
          iconClass={`bg-rose-50 ${CORAL_D}`}
          value={<Money amount={d.debtTotals.clientOwesTotal} />}
          valueClass={CORAL_D}
          label="客户欠款总额"
          badge={owingCount > 0 ? `${owingCount} 户欠款` : undefined}
          scrollTo="debts"
        />
      </div>

      {/* ── ③ 案件进度区：阶段环图（左宽）+ 待办阶段案件（右窄）────── */}
      <div className="grid grid-cols-1 gap-[15px] lg:grid-cols-[1.25fr_1fr]">
        <section className={CARD}>
          <Ch
            title="案件阶段分布"
            small={`在办 ${d.activeCaseCount} · 已下签 ${grantedN}`}
            more={{ to: '/cases', label: '全部案件' }}
          />
          {ringStages.length === 0 ? (
            <p className="px-[22px] pt-2 pb-[22px] text-sm text-faint">暂无在办案件</p>
          ) : (
            <div className="flex flex-wrap items-center gap-[26px] px-[22px] pt-2 pb-[22px]">
              <Donut
                data={ringStages.map((s) => ({ value: s.count, color: s.color }))}
                center={d.activeCaseCount}
                centerSub="在办案件"
              />
              <div className="min-w-[170px] flex-1">
                {ringStages.map((s) => (
                  <div
                    key={s.stage}
                    className="flex items-center gap-[9px] border-b border-surface-2 py-1.5 text-[13.5px] text-muted last:border-b-0"
                  >
                    <span className="size-[9px] shrink-0 rounded-[3px]" style={{ background: s.color }} />
                    <span className="flex-1">
                      {s.label}
                      {s.stage === 'granted' && ' · 已完成'}
                    </span>
                    <span className="text-sm font-bold tabular-nums text-ink">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className={`pb-2 ${CARD}`}>
          <Ch title="待办阶段案件" count={d.todoCases.length} more={{ to: '/cases', label: '全部' }} />
          {d.todoCases.length === 0 ? (
            <p className="px-[22px] py-2.5 text-sm text-faint">暂无待办阶段案件</p>
          ) : (
            <div className="pt-1">
              {d.todoCases.slice(0, 5).map((t) => (
                <Link
                  key={t.caseId}
                  to={`/customers/${t.customerId}?case=${t.caseId}`}
                  state={source}
                  className="flex items-center justify-between border-t border-surface-2 px-[22px] py-2.5 first:border-t-0 hover:opacity-70"
                >
                  <span className="flex min-w-0 items-center gap-[11px]">
                    <Avatar name={displayCustomerName(t.customerName, t.visaLabel)} seed={t.customerId} size={34} radius={10} />
                    <span className="min-w-0">
                      {/* 在册参与人逐个可点 → 各自客户页（外层是案件 <a>，内层用 navigate + stopPropagation） */}
                      <span className="flex flex-wrap items-center gap-x-1 text-sm font-semibold text-ink">
                        {t.participants.length === 0 ? (
                          <span className="truncate">{displayCustomerName('', `${t.visaLabel} · 案件`)}</span>
                        ) : (
                          t.participants.map((p, i) => (
                            <span key={p.id} className="flex items-center gap-x-1">
                              {i > 0 && <span className="text-faint" aria-hidden>、</span>}
                              <span
                                role="link"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  navigate(`/customers/${p.id}`, { state: source })
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    navigate(`/customers/${p.id}`, { state: source })
                                  }
                                }}
                                className="truncate hover:text-brand hover:underline"
                              >
                                {displayCustomerName(p.name)}
                              </span>
                            </span>
                          ))
                        )}
                      </span>
                      <span className="mt-px block truncate text-xs text-faint">{t.visaLabel}</span>
                    </span>
                  </span>
                  <span className="ml-3 shrink-0 rounded-[8px] bg-mute-bg px-[11px] py-[3px] text-[11.5px] font-semibold text-mute-tx">
                    待办
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── ④ 待办清单 + 欠款总览 ────────────────────────────────── */}
      <div className="grid grid-cols-1 items-start gap-[15px] md:grid-cols-2">
        <div id="checklist" className="scroll-mt-4">
          <ChecklistCard notice={dueStrip} />
        </div>

        <section id="debts" className={`scroll-mt-4 pb-1 ${CARD}`}>
          <Ch title="欠款总览" small="按客户" />
          <div className="flex items-baseline justify-end px-[22px] pb-2 text-xs text-faint">
            <span>
              共欠你 <b className={`font-bold tabular-nums ${CORAL_D}`}>{formatMoney(d.debtTotals.clientOwesTotal)}</b>
              <span className="mx-1">·</span>
              欠主代理 <span className="tabular-nums">{formatMoney(d.debtTotals.companyOwesTotal)}</span>
            </span>
          </div>
          {d.customerDebts.length === 0 ? (
            <p className="px-[22px] py-2.5 text-sm text-faint">无未结欠款</p>
          ) : (
            <ul>
              {d.customerDebts.map((c) => (
                <li key={c.customerId} className="border-t border-surface-2">
                  <Link
                    to={`/customers/${c.customerId}`}
                    state={source}
                    className="flex items-center justify-between px-[22px] py-3 transition-opacity hover:opacity-70"
                  >
                    <span className="flex min-w-0 items-center gap-[11px]">
                      <Avatar name={displayCustomerName(c.customerName)} seed={c.customerId} size={34} radius={10} />
                      <span
                        className={`truncate text-sm font-semibold ${
                          c.color === 'default' ? 'text-ink' : CUSTOMER_PAYMENT_TEXT_CLASS[c.color]
                        }`}
                      >
                        {displayCustomerName(c.customerName)}
                      </span>
                    </span>
                    <span className="ml-3 shrink-0 text-right text-sm font-bold tabular-nums">
                      {c.clientOwes > 0 && (
                        <span className={CORAL_D}>
                          <small className="mr-1 text-xs font-medium text-faint">欠你</small>
                          {formatMoney(c.clientOwes)}
                        </span>
                      )}
                      {c.companyOwes > 0 && (
                        <span className="ml-2 text-xs font-medium tabular-nums text-amber-600">
                          欠主代理 {formatMoney(c.companyOwes)}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {/* 逾期未付分期折进底部一行（明细在客户付款区） */}
          <div className="mt-0.5 border-t border-surface-2 px-[22px] pt-3 pb-2 text-xs text-faint">
            逾期未付分期：
            {d.overdueInstallments.length === 0 ? (
              '无'
            ) : (
              <b className={`font-semibold tabular-nums ${CORAL_D}`}>{d.overdueInstallments.length} 笔</b>
            )}
          </div>
        </section>
      </div>

      {/* ── ⑤ 官方签证处理时间 ───────────────────────────────────── */}
      <a
        href={VISA_PROCESSING_TIMES_URL}
        target="_blank"
        rel="noreferrer"
        className={`flex items-center justify-between p-[18px_24px] transition-colors hover:bg-brand-50/40 ${CARD}`}
      >
        <span>
          <span className="block text-[15px] font-semibold text-ink">官方签证处理时间</span>
          <span className="mt-[5px] block text-[12.5px] text-muted">
            在 <span className="font-medium text-[#3f7cb5]">immi.homeaffairs.gov.au</span> 查看全球签证处理时间（新标签打开）
          </span>
        </span>
        <span className="grid size-[34px] shrink-0 place-items-center rounded-[10px] bg-emerald-50 text-base text-emerald-700">
          ↗
        </span>
      </a>
    </div>
  )
}
