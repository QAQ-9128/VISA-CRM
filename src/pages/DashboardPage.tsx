import { Link, useNavigate } from 'react-router-dom'
import { useDashboard } from '../hooks/queries/useDashboard'
import { useChecklistView } from '../hooks/queries/useChecklistView'
import { useAuth } from '../hooks/useAuth'
import { useBackSource } from '../hooks/useBackSource'
import { LoadingBlock, ErrorBlock } from '../components/ui/states'
import { ChecklistCard } from '../components/dashboard/ChecklistCard'
import { Donut } from '../components/dashboard/Donut'
import { Avatar } from '../components/ui/Avatar'
import { AlertCircleIcon, BanknoteIcon } from '../components/ui/icons'
import { STATUS_CATEGORY_META } from '../lib/statusColor'
import { countOwingCustomers, displayCustomerName, pickGreetingName, buildDueSoonList } from '../lib/dashboardView'
import type { DueUrgency } from '../lib/dashboardView'
import type { TodoCaseItem } from '../lib/dashboard'
import { formatAmount, formatMoney } from '../lib/money'

/*
 * 概览（mockup「主次重设计」）：一个主角 + 一群配角的注意力层级，权重从上到下递减。
 *   ① 顶栏  ② 🎯 今天要处理（主角·最大·轻微浮起）  ③ 案件进展 + 钱（中等配角·并排）
 *   ④ 待办 / 已草拟案件（小·一行 chips）  ⑤ 官方签证处理时间（底部窄条）
 * 纯展示重构：全部数字/列表来自 useDashboard / useChecklistView 现有派生，本页零聚合。
 * 状态色与到期紧急度色走单一来源（statusColor / dashboardView.dueUrgency）。
 */

/** DHA 官方签证处理时间页（全球） */
const VISA_PROCESSING_TIMES_URL =
  'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-processing-times/global-visa-processing-times'

const CARD = 'rounded-[20px] bg-white [box-shadow:0_14px_34px_-20px_rgba(40,90,60,.22)]'
const CORAL_D = 'text-[#c25a52]'

/** 临近到期紧急度 → 左竖条 / 行底色 / 数字色（颜色由 dueUrgency 单一来源给出，这里仅做 Tailwind 映射）。 */
const DUE_TONE: Record<DueUrgency, { bar: string; text: string; bg: string }> = {
  red: { bar: 'bg-rose-400', text: CORAL_D, bg: 'bg-rose-50/70' },
  amber: { bar: 'bg-amber-400', text: 'text-amber-600', bg: 'bg-amber-50/60' },
  green: { bar: 'bg-emerald-400', text: 'text-emerald-700', bg: 'bg-emerald-50/60' },
}

/** 金额：AUD 小前缀 + 数字。 */
function Money({ amount }: { amount: number }) {
  return (
    <>
      <span className="mr-[3px] text-[13px] font-semibold text-faint">AUD</span>
      {formatAmount(amount)}
    </>
  )
}

/** 配角卡头：标题 + 小字/计数 + 右侧「全部 ›」。 */
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
      <h2 className="text-[15px] font-semibold text-ink">
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

  const checklistOpen = checklist.openCount
  // 临近到期（30 天内）= 文档/签证到期 + 转 186 TRT + 更新同居材料，合并 + 紧急度分色（单一来源）
  const dueList = buildDueSoonList(d.expiringDocItems, d.trtReminders, d.cohabReminders)
  const dueCount = dueList.length
  // 主角区计数 = 需要行动案件 + 未完成待办
  const todayCount = d.actionCases.length + checklistOpen

  const owingCount = countOwingCustomers(d.customerDebts)
  const ringStages = d.categoryDistribution

  // 需要行动案件（主角左栏顶部）：淡黄底 + 黄点 + 「需要行动」标签，跳出来
  const actionBlock = d.actionCases.length > 0 && (
    <div className="space-y-1.5 px-[22px] pt-2 pb-1">
      {d.actionCases.map((a) => (
        <Link
          key={a.caseId}
          to={`/customers/${a.customerId}?case=${a.caseId}`}
          state={source}
          className="flex items-center gap-2.5 rounded-[11px] bg-[#fdf6e3] px-3 py-2.5 transition-colors hover:bg-[#fbf0d6]"
        >
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ background: STATUS_CATEGORY_META.action.solid }}
            aria-hidden
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-semibold text-ink">
              {displayCustomerName(a.customerName, a.visaLabel)}
            </span>
            <span className="block truncate text-[11.5px] text-faint">{a.visaLabel}</span>
          </span>
          <span className={`shrink-0 rounded-[8px] px-2 py-[2px] text-[11px] font-semibold ${STATUS_CATEGORY_META.action.badge}`}>
            需要行动
          </span>
        </Link>
      ))}
    </div>
  )

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      {/* ── ① 顶栏 ───────────────────────────────────────────────── */}
      <header className="mb-1 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-[27px] font-semibold text-ink">
            你好{greetName && <>，{greetName}</>} <span aria-hidden>👋</span>
          </h1>
          <p className="mt-1.5 text-[13.5px] text-muted">
            待办 <b className="font-semibold tabular-nums text-emerald-700">{checklistOpen}</b> ·
            临近到期 <b className="font-semibold tabular-nums text-emerald-700">{dueCount}</b> ·
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

      {/* ── ② 🎯 今天要处理（主角·最大·轻微浮起）──────────────────────
          更强阴影 + 更大内边距 + 标题 18px；两栏约 1.25 : 1，窄屏上下堆叠。 */}
      <section className="rounded-[22px] bg-white [box-shadow:0_24px_60px_-26px_rgba(40,90,60,.4),0_6px_16px_-10px_rgba(40,90,60,.18)]">
        <div className="flex items-center justify-between px-[26px] pt-[22px] pb-1">
          <h2 className="text-[18px] font-bold text-ink">
            🎯 今天要处理
            {todayCount > 0 && (
              <span className="ml-2.5 inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-[8px] bg-emerald-50 px-2 align-[2px] text-[12.5px] font-bold tabular-nums text-emerald-700">
                {todayCount}
              </span>
            )}
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_1fr]">
          {/* 左：待办 & 需要行动 */}
          <div className="min-w-0">
            <div className="px-[22px] pt-3">
              <h3 className="text-[13px] font-semibold tracking-wide text-muted">待办 &amp; 需要行动</h3>
            </div>
            {/* 需要行动案件（顶部）+ 待办清单（可勾选）+ 底部添加输入 */}
            <ChecklistCard bare hideTitle inputAtBottom topSlot={actionBlock} />
          </div>

          {/* 右：⏰ 临近到期（30 天内）*/}
          <div className="min-w-0 border-t border-line lg:border-t-0 lg:border-l">
            <div className="flex items-center justify-between px-[22px] pt-3 pb-1">
              <h3 className="text-[13px] font-semibold tracking-wide text-muted">
                ⏰ 临近到期（30 天内）
                {dueCount > 0 && (
                  <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-[7px] bg-emerald-50 px-1.5 text-[11.5px] font-semibold tabular-nums text-emerald-700">
                    {dueCount}
                  </span>
                )}
              </h3>
            </div>
            {dueList.length === 0 ? (
              <p className="px-[22px] py-3 text-[13px] text-faint">近 30 天无临近到期 🎉</p>
            ) : (
              <ul className="space-y-1.5 px-[22px] pt-1.5 pb-2">
                {dueList.map((e) => {
                  const tone = DUE_TONE[e.urgency]
                  return (
                    <li key={e.key}>
                      <Link
                        to={e.to}
                        state={source}
                        className={`flex items-stretch overflow-hidden rounded-[11px] ${tone.bg} transition-opacity hover:opacity-80`}
                      >
                        <span className={`w-1 shrink-0 ${tone.bar}`} aria-hidden />
                        <span className="flex min-w-0 flex-1 items-center justify-between gap-3 px-3 py-2">
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-semibold text-ink">
                              {displayCustomerName(e.customerName)}
                            </span>
                            <span className="block truncate text-[11.5px] text-muted">{e.matter}</span>
                          </span>
                          <span className={`shrink-0 text-[12.5px] font-bold tabular-nums ${tone.text}`}>{e.detail}</span>
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* ── ③ 案件进展 + 钱（中等配角·并排，明显小于主角）──────────────── */}
      <div className="grid grid-cols-1 items-start gap-[15px] md:grid-cols-2">
        {/* 案件进展：阶段分布环 + 图例 */}
        <section className={CARD}>
          <Ch title="案件进展" small={`在办 ${d.activeCaseCount} · 已下签 ${d.grantedCount}`} more={{ to: '/cases', label: '全部案件' }} />
          {ringStages.length === 0 ? (
            <p className="px-[22px] pt-2 pb-[22px] text-sm text-faint">暂无在办案件</p>
          ) : (
            <div className="flex flex-wrap items-center gap-5 px-[22px] pt-1 pb-[20px]">
              <Donut
                data={ringStages.map((s) => ({ value: s.count, color: s.color }))}
                size={150}
                center={d.activeCaseCount}
                centerSub="在办"
              />
              <div className="min-w-[160px] flex-1">
                {ringStages.map((s) => (
                  <div
                    key={s.category}
                    className="flex items-center gap-[9px] border-b border-surface-2 py-1.5 text-[13px] text-muted last:border-b-0"
                  >
                    <span className="size-[9px] shrink-0 rounded-[3px]" style={{ background: s.color }} />
                    <span className="flex-1">{s.label}</span>
                    <span className="text-sm font-bold tabular-nums text-ink">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* 钱：本月收款（绿）+ 客户欠款（珊瑚 + N 户欠款角标）*/}
        <section className={CARD}>
          <Ch title="钱" small="本月 · 应收" more={{ to: '/finance', label: '财务' }} />
          <div className="grid grid-cols-1 gap-3 px-[22px] pt-2 pb-[20px] sm:grid-cols-2">
            <Link
              to="/finance"
              state={source}
              className="rounded-[14px] bg-emerald-50/60 p-4 transition-colors hover:bg-emerald-50"
            >
              <span className="mb-2 grid size-[34px] place-items-center rounded-[10px] bg-emerald-100/70 text-emerald-700">
                <BanknoteIcon className="size-[18px]" />
              </span>
              <div className="text-[22px] font-bold tabular-nums text-emerald-700">
                <Money amount={d.thisMonthReceipts} />
              </div>
              <div className="mt-0.5 text-[12px] text-muted">本月收款</div>
            </Link>
            <Link
              to="/finance"
              state={source}
              className="relative rounded-[14px] bg-rose-50/60 p-4 transition-colors hover:bg-rose-50"
            >
              {owingCount > 0 && (
                <span className={`absolute right-3 top-3 rounded-[7px] bg-white px-2 py-[2px] text-[11px] font-semibold ${CORAL_D}`}>
                  {owingCount} 户欠款
                </span>
              )}
              <span className={`mb-2 grid size-[34px] place-items-center rounded-[10px] bg-rose-100/60 ${CORAL_D}`}>
                <AlertCircleIcon className="size-[18px]" />
              </span>
              <div className={`text-[22px] font-bold tabular-nums ${CORAL_D}`}>
                <Money amount={d.debtTotals.clientOwesTotal} />
              </div>
              <div className="mt-0.5 text-[12px] text-muted">客户欠款总额</div>
            </Link>
          </div>
        </section>
      </div>

      {/* ── ④ 待办 / 已草拟 案件（小·一行可换行 chips）────────────────── */}
      <section className={`pb-3 ${CARD}`}>
        <Ch title="待办 / 已草拟 案件" count={d.todoCases.length} more={{ to: '/cases', label: '全部' }} />
        {d.todoCases.length === 0 ? (
          <p className="px-[22px] py-2.5 text-sm text-faint">暂无待办 / 已草拟 案件</p>
        ) : (
          <div className="flex flex-wrap gap-2 px-[22px] pt-2">
            {d.todoCases.map((t) => (
              <CaseChip key={t.caseId} item={t} onPick={(id) => navigate(`/customers/${id}`, { state: source })} source={source} />
            ))}
          </div>
        )}
      </section>

      {/* ── ⑤ 官方签证处理时间（底部窄条）────────────────────────────── */}
      <a
        href={VISA_PROCESSING_TIMES_URL}
        target="_blank"
        rel="noreferrer"
        className={`flex items-center justify-between p-[16px_22px] transition-colors hover:bg-brand-50/40 ${CARD}`}
      >
        <span className="flex items-center gap-3">
          <span className="grid size-[32px] shrink-0 place-items-center rounded-[10px] bg-[#e6edf7] text-[#3f7cb5]">🌐</span>
          <span>
            <span className="block text-[14px] font-semibold text-ink">官方签证处理时间</span>
            <span className="mt-px block text-[12px] text-muted">
              在 <span className="font-medium text-[#3f7cb5]">immi.homeaffairs.gov.au</span> 查看全球签证处理时间（新标签打开）
            </span>
          </span>
        </span>
        <span className="grid size-[32px] shrink-0 place-items-center rounded-[10px] bg-emerald-50 text-base text-emerald-700">↗</span>
      </a>
    </div>
  )
}

/** 待办/已草拟案件 chip：头像 + 参与人姓名（各自可点）+ 类型。整 chip 跳案件。 */
function CaseChip({
  item,
  onPick,
  source,
}: {
  item: TodoCaseItem
  onPick: (customerId: string) => void
  source: ReturnType<typeof useBackSource>
}) {
  return (
    <Link
      to={`/customers/${item.customerId}?case=${item.caseId}`}
      state={source}
      className="inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-white py-1.5 pl-1.5 pr-3 transition-colors hover:border-brand-100 hover:bg-brand-50/40"
    >
      <Avatar name={displayCustomerName(item.customerName, item.visaLabel)} seed={item.customerId} size={26} radius={999} />
      <span className="flex min-w-0 items-center gap-x-1 text-[12.5px] font-semibold text-ink">
        {item.participants.length === 0 ? (
          <span className="truncate">{displayCustomerName('', `${item.visaLabel} · 案件`)}</span>
        ) : (
          item.participants.map((p, i) => (
            <span key={p.id} className="flex items-center gap-x-1">
              {i > 0 && <span className="text-faint" aria-hidden>、</span>}
              <span
                role="link"
                tabIndex={0}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onPick(p.id)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    e.stopPropagation()
                    onPick(p.id)
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
      <span className="shrink-0 text-[11px] text-faint">{item.visaLabel}</span>
    </Link>
  )
}
