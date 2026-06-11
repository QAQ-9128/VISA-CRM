import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useFinance } from '../../hooks/queries/useFinance'
import { LoadingBlock, ErrorBlock } from '../../components/ui/states'
import { useBackSource } from '../../hooks/useBackSource'
import { avatarInitial } from '../../lib/avatar'
import { formatAmount, formatMoney } from '../../lib/money'
import { currentMonth, shiftMonth } from '../../lib/month'
import { auFinancialYear, fyOfEndYear, fyOfMonth, clampMonthToFy } from '../../lib/dateRules'
import {
  selectMonthlyOverview,
  groupPayouts,
  monthTitle,
  formatMonthDay,
  formatYearMonth,
  receiptSubtitle,
  payoutSubtitle,
  payoutDisplayName,
} from '../../lib/monthlyOverview'
import type { ReceiptItem, PayoutItem } from '../../lib/finance'
import type { FinancePeriod } from '../../hooks/queries/useFinance'

/*
 * 月度账目（mockup「双流总览」1:1）：Header(衬线标题+月份 pill) → 三 KPI → 双栏对照 → 净额结算条。
 * 「月度 / 财年」段控（mockup「账目-加财年开关」）：财年模式 = 同一页面同一套聚合，仅把日期窗口
 * 换成澳洲财年（7/1→次年 6/30，lib/dateRules auFinancialYear），文案换「本财年」、对比换「较上财年」。
 * 纯展示页——所有数字直接来自 useFinance 现有聚合（selectFinanceReceipts / selectFinancePayouts），
 * 本页只做双流恒等式（lib/monthlyOverview）与排版。色值/字号/间距照 mockup CSS。
 * mockup 色对应：green-d=emerald-700(#357a52) · green-deep=brand-700(#2e6a48) · green-bg=emerald-50(#e3f0e6)
 *               coral-d=#c25a52(无令牌，按图取值) · coral-bg=rose-50(#fbe7e4) · line2=surface-2(#f1f6f1)
 */

const CARD_SHADOW = '[box-shadow:0_14px_34px_-20px_rgba(40,90,60,.22)]'
const CORAL_D = 'text-[#c25a52]'

/** KPI 大数：AUD 前缀小字 + 29px 粗体数字（mockup .kpi .val）。 */
function KpiValue({ amount, className, ccyClassName }: { amount: number; className: string; ccyClassName: string }) {
  return (
    <div className={`mt-[5px] text-[29px] font-bold tracking-[.3px] tabular-nums ${className}`}>
      <span className={`mr-1 text-[14px] font-semibold ${ccyClassName}`}>AUD</span>
      {formatAmount(amount)}
    </div>
  )
}

/** 收入栏逐笔行：头像首字 + 付款方客户名 + 签证 tag + 款项 + 绿色金额 + 日期（财年模式带年份）。 */
function IncomeRow({ item, fyMode }: { item: ReceiptItem; fyMode?: boolean }) {
  const source = useBackSource()
  return (
    <div className="flex items-center justify-between border-t border-surface-2 px-[22px] py-[11px] first:border-t-0">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid size-[30px] shrink-0 place-items-center rounded-[9px] bg-mute-bg text-[12px] font-semibold text-mute-tx">
          {avatarInitial(item.customerName)}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-[7px] text-[14px] font-semibold text-ink">
            <Link to={`/customers/${item.payerId}`} state={source} className="truncate hover:underline">
              {item.customerName || '（未知客户）'}
            </Link>
            {item.visaSubclass && (
              <span className="shrink-0 rounded-[6px] bg-emerald-50 px-[7px] py-px text-[10.5px] font-semibold text-emerald-700">
                {item.visaSubclass}
              </span>
            )}
          </div>
          <div className="mt-[2px] truncate text-[12px] text-faint">{receiptSubtitle(item)}</div>
        </div>
      </div>
      <div className="ml-3 shrink-0 text-right">
        <div className="text-[15px] font-bold tabular-nums text-emerald-700">{formatAmount(item.amount)}</div>
        <div className="mt-px text-[11.5px] text-faint">{fyMode ? formatYearMonth(item.paidAt) : formatMonthDay(item.paidAt)}</div>
      </div>
    </div>
  )
}

/** 支出栏逐笔行：收款方（付主代理=该案客户 / 付介绍人=介绍人）+ 签证 tag + 款项 + 珊瑚金额 + 日期。 */
function PayoutRow({ item, visa, fyMode }: { item: PayoutItem; visa?: string; fyMode?: boolean }) {
  const source = useBackSource()
  const name = payoutDisplayName(item)
  return (
    <div className="flex items-center justify-between border-t border-surface-2 px-[22px] py-[11px] first:border-t-0">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid size-[30px] shrink-0 place-items-center rounded-[9px] bg-mute-bg text-[12px] font-semibold text-mute-tx">
          {avatarInitial(name)}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-[7px] text-[14px] font-semibold text-ink">
            {item.direction === 'to_company' ? (
              <Link to={`/customers/${item.customerId}?case=${item.caseId}`} state={source} className="truncate hover:underline">
                {name}
              </Link>
            ) : (
              <span className="truncate">{name}</span>
            )}
            {visa && (
              <span className={`shrink-0 rounded-[6px] bg-rose-50 px-[7px] py-px text-[10.5px] font-semibold ${CORAL_D}`}>
                {visa}
              </span>
            )}
          </div>
          <div className="mt-[2px] truncate text-[12px] text-faint">{payoutSubtitle(item)}</div>
        </div>
      </div>
      <div className="ml-3 shrink-0 text-right">
        <div className={`text-[15px] font-bold tabular-nums ${CORAL_D}`}>{formatAmount(item.amount)}</div>
        <div className="mt-px text-[11.5px] text-faint">{fyMode ? formatYearMonth(item.paidAt) : formatMonthDay(item.paidAt)}</div>
      </div>
    </div>
  )
}

/** 双栏卡头（mockup .ch）：图标 + 名称 + 取数口径小字 + 右上小计。 */
function ColHeader({
  icon,
  iconClass,
  name,
  caption,
  subtotalLabel,
  subtotal,
  amountClass,
}: {
  icon: string
  iconClass: string
  name: string
  caption: string
  subtotalLabel: string
  subtotal: number
  amountClass: string
}) {
  return (
    <div className="flex items-center justify-between border-b border-line px-[22px] pb-4 pt-[18px]">
      <div className="flex items-center gap-[11px]">
        <span className={`grid size-[34px] place-items-center rounded-[10px] text-[17px] ${iconClass}`}>{icon}</span>
        <div>
          <div className="text-[16px] font-semibold text-ink">{name}</div>
          <div className="mt-[2px] text-[11.5px] text-faint">{caption}</div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-[11px] text-faint">{subtotalLabel}</div>
        <div className={`mt-px text-[22px] font-bold tabular-nums ${amountClass}`}>{formatAmount(subtotal)}</div>
      </div>
    </div>
  )
}

/** 卡底浅灰小计条（mockup .colsub）。 */
function ColSubtotal({ label, amount, amountClass }: { label: string; amount: number; amountClass: string }) {
  return (
    <div className="mt-auto flex items-center justify-between bg-surface-2 px-[22px] py-[13px] text-[13px]">
      <span className="text-muted">{label}</span>
      <b className={`font-bold tabular-nums ${amountClass}`}>{formatMoney(amount)}</b>
    </div>
  )
}

export function FinancePage() {
  // 「月度 / 财年」段控：月度 = 原页面一字不差；财年 = 同一套聚合换成 FY 日期窗口
  const [mode, setMode] = useState<'month' | 'fy'>('month')
  const [month, setMonth] = useState<string>(() => currentMonth())
  const [fyEnd, setFyEnd] = useState<number>(() => auFinancialYear().endYear)
  const isFy = mode === 'fy'
  const financePeriod: FinancePeriod = isFy ? { kind: 'fy', endYear: fyEnd } : { kind: 'month', month }
  const { isPending, isError, receipts, payouts, prevReceipts, prevPayouts, visaByCaseId } = useFinance(financePeriod)

  const fy = fyOfEndYear(fyEnd)
  const isCurrent = isFy ? fyEnd === auFinancialYear().endYear : month === currentMonth()
  const period = isFy ? (isCurrent ? '本财年' : '该财年') : isCurrent ? '本月' : '当月'
  const prevLabel = isFy ? '较上财年' : '较上月'

  /** 段控切换（跟随联动）：月→财跳到所选月份所属财年；财→月保留财年内原月份，否则把「本月」夹进该财年。 */
  const switchMode = (next: 'month' | 'fy') => {
    if (next === mode) return
    if (next === 'fy') setFyEnd(fyOfMonth(month).endYear)
    else setMonth((prev) => (clampMonthToFy(prev, fy) === prev ? prev : clampMonthToFy(currentMonth(), fy)))
    setMode(next)
  }

  // 上一周期完全无流水 → 无对比基数，省略「较上月 / 较上财年」（不编数字）
  const hasPrev = (prevReceipts?.items.length ?? 0) > 0 || (prevPayouts?.items.length ?? 0) > 0
  const overview = useMemo(
    () =>
      selectMonthlyOverview(
        receipts ?? { items: [], total: 0 },
        payouts ?? { items: [], toCompanyTotal: 0, toReferrerTotal: 0, miscTotal: 0 },
        hasPrev ? prevReceipts : undefined,
        hasPrev ? prevPayouts : undefined,
      ),
    [receipts, payouts, prevReceipts, prevPayouts, hasPrev],
  )
  const groups = useMemo(() => groupPayouts(payouts?.items ?? []), [payouts?.items])

  if (isPending) return <LoadingBlock />
  if (isError) return <ErrorBlock error={new Error('财务数据加载失败，请刷新重试')} />

  const d = overview.delta
  const delta = d && {
    up: d.amount >= 0,
    money: formatMoney(Math.abs(d.amount)),
    pct: d.pct === null ? '' : `（${d.pct >= 0 ? '+' : '−'}${Math.abs(d.pct)}%）`,
  }
  const expenseCount = groups.toCompany.length + groups.toReferrer.length + groups.misc.length

  return (
    <section className="mx-auto max-w-[1180px]">
      {/* ── Header：衬线标题 + 段控（月度/财年）+ 周期切换 pill ─────────── */}
      <div className="mb-[22px] flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[30px] font-semibold tracking-[.5px] text-ink">{isFy ? '收支账目' : '月度账目'}</h1>
          <p className="mt-[7px] text-[14px] text-muted">
            {isFy ? '收入 / 支出 双流对照' : `${period}收支总览 · `}
            {!isFy && <b className="font-semibold text-emerald-700">收入 / 支出 双流对照</b>}
            {' · 币种 AUD'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* 段控：月度 / 财年（mockup：浅灰容器，选中白底浮起） */}
          <div className="flex items-center gap-1 rounded-[12px] border border-line bg-surface-2 p-1">
            {(['month', 'fy'] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => switchMode(m)}
                className={`rounded-[9px] px-3 py-[5px] text-[13px] font-semibold transition-colors ${
                  mode === m ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'
                }`}
              >
                {m === 'month' ? '月度' : '财年'}
              </button>
            ))}
          </div>
          {isFy ? (
            /* 财年选择器：‹ 2025–26 财年（本财年）· 起止日期 › */
            <div className={`flex items-center gap-[14px] rounded-[14px] border border-line bg-white px-4 py-[6px] [box-shadow:0_8px_22px_-16px_rgba(40,90,60,.30)]`}>
              <button
                type="button"
                aria-label="上一财年"
                onClick={() => setFyEnd((y) => y - 1)}
                className="grid size-[26px] place-items-center rounded-[8px] bg-emerald-50 text-[14px] font-bold text-emerald-700 hover:bg-emerald-100"
              >
                ‹
              </button>
              <div className="text-center">
                <div className="text-[15px] font-semibold leading-tight text-ink">
                  {fy.label}
                  {isCurrent && (
                    <span className="ml-[6px] rounded-[6px] bg-emerald-50 px-[6px] py-px align-middle text-[10.5px] font-semibold text-emerald-700">
                      本财年
                    </span>
                  )}
                </div>
                <div className="mt-px text-[11px] tabular-nums text-faint">
                  {fy.startYmd} ~ {fy.endYmd}
                </div>
              </div>
              <button
                type="button"
                aria-label="下一财年"
                onClick={() => setFyEnd((y) => y + 1)}
                className="grid size-[26px] place-items-center rounded-[8px] bg-emerald-50 text-[14px] font-bold text-emerald-700 hover:bg-emerald-100"
              >
                ›
              </button>
            </div>
          ) : (
            <div className={`flex items-center gap-[14px] rounded-[14px] border border-line bg-white px-4 py-[9px] [box-shadow:0_8px_22px_-16px_rgba(40,90,60,.30)]`}>
              <button
                type="button"
                aria-label="上个月"
                onClick={() => setMonth((m) => shiftMonth(m, -1))}
                className="grid size-[26px] place-items-center rounded-[8px] bg-emerald-50 text-[14px] font-bold text-emerald-700 hover:bg-emerald-100"
              >
                ‹
              </button>
              <div className="text-[16px] font-semibold text-ink">
                {monthTitle(month)}
                {isCurrent && <span className="ml-[6px] text-[11px] font-normal text-faint">本月</span>}
              </div>
              <button
                type="button"
                aria-label="下个月"
                onClick={() => setMonth((m) => shiftMonth(m, 1))}
                className="grid size-[26px] place-items-center rounded-[8px] bg-emerald-50 text-[14px] font-bold text-emerald-700 hover:bg-emerald-100"
              >
                ›
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── KPI 三卡 ─────────────────────────────────────────────── */}
      <div className="mb-[18px] grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* 收入（绿）。「开票应收/已收率」无真实月度口径来源 → 整行省略 */}
        <div className={`rounded-[20px] bg-white p-[20px_22px] ${CARD_SHADOW}`}>
          <span className="mb-[13px] grid size-10 place-items-center rounded-[12px] bg-emerald-50 text-[19px] text-emerald-700">↘</span>
          <div className="text-[13px] text-muted">{period}收入 · 客户已收</div>
          <KpiValue amount={overview.income} className="text-emerald-700" ccyClassName="text-faint" />
        </div>
        {/* 支出（珊瑚红）：三流（付主代理/付介绍人/垫付杂项），小字 = 真实分组和 */}
        <div className={`rounded-[20px] bg-white p-[20px_22px] ${CARD_SHADOW}`}>
          <span className={`mb-[13px] grid size-10 place-items-center rounded-[12px] bg-rose-50 text-[19px] ${CORAL_D}`}>↗</span>
          <div className="text-[13px] text-muted">{period}支出 · 付主代理 + 介绍人 + 垫付</div>
          <KpiValue amount={overview.expense} className={CORAL_D} ccyClassName="text-faint" />
          <div className="mt-2 text-[12px] tabular-nums text-faint">
            付主代理 {formatAmount(overview.toCompany)} · 付介绍人 {formatAmount(overview.toReferrer)} · 垫付杂项 {formatAmount(overview.misc)}
          </div>
        </div>
        {/* 净额（深绿渐变实心）：小字 = 较上月（仅上月有流水时显示） */}
        <div className={`rounded-[20px] bg-[linear-gradient(135deg,#2e6a48,#357a52)] p-[20px_22px] ${CARD_SHADOW}`}>
          <span className="mb-[13px] grid size-10 place-items-center rounded-[12px] bg-white/18 text-[19px] text-[#eafff2]">＝</span>
          <div className="text-[13px] text-[#d4ecdd]">{period}净额</div>
          <KpiValue amount={overview.net} className="text-white" ccyClassName="text-[#bfe0cb]" />
          {delta && (
            <div className="mt-2 text-[12px] tabular-nums text-[#cfe9d8]">
              {prevLabel} <span className="inline-flex items-center gap-1 font-semibold">{delta.up ? '▲' : '▼'} {delta.money} {delta.pct}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── 双栏对照：左收入 / 右支出 ───────────────────────────────── */}
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* 收入栏 */}
        <div className={`flex flex-col overflow-hidden rounded-[20px] bg-white ${CARD_SHADOW}`}>
          <ColHeader
            icon="＄"
            iconClass="bg-emerald-50 text-emerald-700"
            name="收入"
            caption="客户已收（from_client）"
            subtotalLabel={`${period}小计`}
            subtotal={overview.income}
            amountClass="text-emerald-700"
          />
          <div className={`pb-[2px] pt-[6px] ${isFy ? 'max-h-[430px] overflow-y-auto' : ''}`}>
            {receipts.items.length === 0 ? (
              <p className="px-[22px] py-10 text-center text-sm text-faint">{period}暂无收入</p>
            ) : (
              receipts.items.map((item) => <IncomeRow key={item.paymentId} item={item} fyMode={isFy} />)
            )}
          </div>
          {isFy && receipts.items.length > 0 && (
            <div className="border-t border-surface-2 px-[22px] py-[9px] text-[11.5px] text-faint">
              财年内共 {receipts.items.length} 笔收入 · 滚动查看全部
            </div>
          )}
          <ColSubtotal
            label={`收入小计（${receipts.items.length} 笔）`}
            amount={overview.income}
            amountClass="text-emerald-700"
          />
        </div>

        {/* 支出栏：付主代理 / 付介绍人 两组 */}
        <div className={`flex flex-col overflow-hidden rounded-[20px] bg-white ${CARD_SHADOW}`}>
          <ColHeader
            icon="↗"
            iconClass={`bg-rose-50 ${CORAL_D}`}
            name="支出"
            caption="付主代理 + 付介绍人 + 垫付杂项"
            subtotalLabel={`${period}小计`}
            subtotal={overview.expense}
            amountClass={CORAL_D}
          />
          <div className={`pb-[2px] pt-[6px] ${isFy ? 'max-h-[430px] overflow-y-auto' : ''}`}>
            {expenseCount === 0 && <p className="px-[22px] py-10 text-center text-sm text-faint">{period}暂无支出</p>}
            {groups.toCompany.length > 0 && (
              <div>
                <div className="px-[22px] pb-[5px] pt-[11px] text-[11.5px] font-semibold tracking-[.4px] text-faint">
                  付主代理（to_company）
                </div>
                {groups.toCompany.map((item) => (
                  <PayoutRow key={item.paymentId} item={item} visa={visaByCaseId?.[item.caseId]} fyMode={isFy} />
                ))}
              </div>
            )}
            {groups.toReferrer.length > 0 && (
              <div>
                <div className="px-[22px] pb-[5px] pt-[11px] text-[11.5px] font-semibold tracking-[.4px] text-faint">
                  付介绍人（to_referrer）
                </div>
                {groups.toReferrer.map((item) => (
                  <PayoutRow key={item.paymentId} item={item} visa={visaByCaseId?.[item.caseId]} fyMode={isFy} />
                ))}
              </div>
            )}
            {groups.misc.length > 0 && (
              <div>
                <div className="px-[22px] pb-[5px] pt-[11px] text-[11.5px] font-semibold tracking-[.4px] text-faint">
                  垫付杂项（misc_expense）
                </div>
                {groups.misc.map((item) => (
                  <PayoutRow key={item.paymentId} item={item} visa={visaByCaseId?.[item.caseId]} fyMode={isFy} />
                ))}
              </div>
            )}
          </div>
          {isFy && expenseCount > 0 && (
            <div className="border-t border-surface-2 px-[22px] py-[9px] text-[11.5px] text-faint">
              财年内共 {expenseCount} 笔支出 · 滚动查看全部
            </div>
          )}
          <ColSubtotal
            label={`支出小计（${expenseCount} 笔）`}
            amount={overview.expense}
            amountClass={CORAL_D}
          />
        </div>
      </div>

      {/* ── 净额结算条 ──────────────────────────────────────────── */}
      <div className={`flex flex-wrap items-center justify-between gap-4 rounded-[20px] border-l-[5px] border-brand-700 bg-white p-[20px_26px] ${CARD_SHADOW}`}>
        <div>
          <div className="text-[13px] text-muted">{period}净额（双流恒等）</div>
          <div className="mt-[6px] text-[12.5px] tabular-nums text-faint">
            <span className="font-semibold text-emerald-700">收入 {formatAmount(overview.income)}</span>
            <span className="mx-1.5">−</span>
            <span className={`font-semibold ${CORAL_D}`}>支出 {formatAmount(overview.expense)}</span>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-[32px] font-bold tracking-[.3px] tabular-nums ${overview.net < 0 ? CORAL_D : 'text-brand-700'}`}>
            <span className="mr-1 text-[15px] font-semibold text-faint">AUD</span>
            {formatAmount(overview.net)}
          </div>
          {delta && (
            <div className={`mt-1 text-[12.5px] font-semibold tabular-nums ${delta.up ? 'text-emerald-700' : CORAL_D}`}>
              {delta.up ? '▲' : '▼'} {prevLabel} {delta.up ? '+' : '−'}{delta.money}{delta.pct}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
