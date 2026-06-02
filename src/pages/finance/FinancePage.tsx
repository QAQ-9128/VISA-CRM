import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useFinance } from '../../hooks/queries/useFinance'
import { Card } from '../../components/ui/Card'
import { LoadingBlock, ErrorBlock } from '../../components/ui/states'
import { FinanceReceivablesTable } from '../../components/finance/FinanceReceivablesTable'
import { MonthlyLedgerTable } from '../../components/finance/MonthlyLedgerTable'
import { MonthSelector } from '../../components/finance/MonthSelector'
import { BanknoteIcon, ClockIcon, SearchIcon, UsersIcon, WalletIcon } from '../../components/ui/icons'
import { sumFinanceReceivables, selectCasePaymentColors } from '../../lib/finance'
import {
  buildFinanceTableRows,
  filterFinanceTableRows,
  owingCustomerCount,
  financeRowsToCsv,
} from '../../lib/financeRows'
import type { FinanceStatusKind } from '../../lib/financeRows'
import { formatMoney } from '../../lib/money'
import { currentMonth } from '../../lib/month'

/** 统计卡：彩色圆标 + 标签 + 大数字。 */
function FStat({ icon, bg, label, value }: { icon: ReactNode; bg: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3.5 rounded-[18px] border border-line bg-white p-4 shadow-xs">
      <span className="grid size-12 shrink-0 place-items-center rounded-full text-white" style={{ background: bg }}>
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[12.5px] text-muted">{label}</div>
        <div className="truncate text-[19px] font-bold tabular-nums text-ink">{value}</div>
      </div>
    </div>
  )
}

const STATUS_OPTIONS: { value: '' | FinanceStatusKind; label: string }[] = [
  { value: '', label: '全部状态' },
  { value: 'pending', label: '待收' },
  { value: 'overdue', label: '逾期' },
  { value: 'settled', label: '已结清' },
  { value: 'unset', label: '未设应收' },
]

export function FinancePage() {
  const [month, setMonth] = useState<string | null>(() => currentMonth())
  const [showAll, setShowAll] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'' | FinanceStatusKind>('')
  // 月度账目：全部/收入/支出 切换（记收款/加支出/查看全部 已下放到合并流水表内部）
  const [ledgerView, setLedgerView] = useState<'all' | 'income' | 'expense'>('all')
  const {
    isPending,
    isError,
    receivables,
    recentCaseIds,
    receipts,
    payouts,
    caseOptions,
    referrerById,
    instByPlan,
    caseNumberByCaseId,
  } = useFinance(month)

  // 全部富表行（含分期/状态/进度），统计卡用全量
  const allRows = useMemo(
    () => buildFinanceTableRows(receivables, instByPlan, caseNumberByCaseId),
    [receivables, instByPlan, caseNumberByCaseId],
  )
  const grandTotals = useMemo(() => sumFinanceReceivables(receivables), [receivables])
  const oweCustomers = useMemo(() => owingCustomerCount(receivables), [receivables])

  // 搜索 + 状态过滤
  const hasFilter = search.trim() !== '' || status !== ''
  const filtered = useMemo(() => filterFinanceTableRows(allRows, { search, status }), [allRows, search, status])
  // 近期案件（前 5 个案件的应收行），有搜索/筛选时直接看全部
  const recentRows = useMemo(() => {
    const order = new Map(recentCaseIds.map((id, i) => [id, i]))
    return filtered
      .filter((e) => order.has(e.row.caseId))
      .sort((a, b) => order.get(a.row.caseId)! - order.get(b.row.caseId)!)
  }, [filtered, recentCaseIds])
  const shown = showAll || hasFilter ? filtered : recentRows
  const shownTotals = useMemo(() => sumFinanceReceivables(shown.map((e) => e.row)), [shown])
  const hiddenCount = filtered.length - recentRows.length

  // 收款明细按案件应收状态着色
  const colorByCase = useMemo(() => selectCasePaymentColors(receivables), [receivables])

  // 月度三总计
  const totalExpense = useMemo(
    () => Math.round((payouts.toCompanyTotal + payouts.toReferrerTotal) * 100) / 100,
    [payouts.toCompanyTotal, payouts.toReferrerTotal],
  )
  const net = Math.round((receipts.total - totalExpense) * 100) / 100
  const periodLabel = month ? '本月' : ''

  if (isPending) return <LoadingBlock />
  if (isError) return <ErrorBlock error={new Error('财务数据加载失败，请刷新重试')} />

  function exportCsv() {
    const csv = financeRowsToCsv(shown)
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `近期案件应收_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="mx-auto max-w-[1040px] space-y-5">
      <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">财务</h1>

      {/* ── 上半部：近期案件应收 ─────────────────────────────────────── */}
      <div>
        <h2 className="text-[20px] font-bold tracking-[-0.01em] text-ink">近期案件应收</h2>
        <p className="mt-1 text-[13px] text-faint">支持分期收款管理 · 快速查看总进度、分期进度与下一期安排</p>
      </div>

      {/* 4 统计卡 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <FStat icon={<BanknoteIcon className="size-6" />} bg="#3b6bff" label="总应收" value={formatMoney(grandTotals.receivable)} />
        <FStat icon={<WalletIcon className="size-6" />} bg="#10b981" label="已收款" value={formatMoney(grandTotals.paid)} />
        <FStat icon={<ClockIcon className="size-6" />} bg="#f59e0b" label="待收款" value={formatMoney(grandTotals.unpaid)} />
        <FStat icon={<UsersIcon className="size-6" />} bg="#8b5cf6" label="欠款客户" value={String(oweCustomers)} />
      </div>

      {/* 工具条：搜索 + 状态筛选 + 导出（月份筛选在下方「月度账目」） */}
      <Card className="!p-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-11 min-w-[200px] flex-1 items-center gap-2.5 rounded-xl border border-line-2 bg-white px-3.5 text-faint focus-within:border-brand focus-within:ring-2 focus-within:ring-brand-100">
            <SearchIcon className="size-[18px] shrink-0" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索客户 / 案件号 / 签证类别"
              className="h-full w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-faint"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as '' | FinanceStatusKind)}
            className="h-11 rounded-xl border border-line-2 bg-white px-3.5 text-sm font-medium text-body outline-none focus:border-brand focus:ring-2 focus:ring-brand-100"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={exportCsv}
            disabled={shown.length === 0}
            className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-line-2 bg-white px-4 text-sm font-semibold text-body hover:bg-surface-2 disabled:opacity-50"
          >
            ↥ 导出
          </button>
        </div>
      </Card>

      {/* 富表 + 合计 + 查看全部 */}
      <Card pad={false}>
        <div className="px-[22px] pt-2">
          <FinanceReceivablesTable rows={shown} totals={shownTotals} />
        </div>
        <div className="px-[22px] py-4">
          {hasFilter ? (
            <span className="text-[12.5px] text-faint">筛选出 {filtered.length} 行</span>
          ) : hiddenCount > 0 ? (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="text-sm font-semibold text-brand hover:underline"
            >
              {showAll ? '收起' : `查看全部应收（共 ${filtered.length} 行，还有 ${hiddenCount} 行）`}
            </button>
          ) : (
            <span className="text-[12.5px] text-faint">共 {filtered.length} 行</span>
          )}
        </div>
      </Card>

      {/* ── 下半部：月度账目 ─────────────────────────────────────────── */}
      <Card pad={false}>
        {/* 头部：标题 + 月份切换 + 全部/收入/支出 */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-[22px] pt-[22px]">
          <div>
            <h2 className="text-base font-bold text-ink">月度账目</h2>
            <p className="mt-0.5 text-[12.5px] text-faint">按月查看收入 / 支出明细与净额</p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <MonthSelector value={month} onChange={setMonth} />
            <div className="inline-flex gap-1 rounded-full bg-surface-2 p-1">
              {(['all', 'income', 'expense'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setLedgerView(v)}
                  className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                    ledgerView === v ? 'bg-white text-brand shadow-xs' : 'text-muted hover:text-body'
                  }`}
                >
                  {v === 'all' ? '全部' : v === 'income' ? '收入' : '支出'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6 px-[22px] pt-[18px] pb-[22px]">
          {/* 3 汇总卡：收入 | 净额(强调) | 支出 */}
          <div className="grid grid-cols-1 items-stretch gap-3.5 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-[16px] bg-emerald-50 p-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-emerald-500 text-white"><WalletIcon className="size-[22px]" /></span>
              <div className="min-w-0">
                <p className="text-[12.5px] text-emerald-700">{periodLabel}总收入</p>
                <p className="truncate text-[20px] font-bold tabular-nums text-emerald-600">{formatMoney(receipts.total)}</p>
              </div>
            </div>
            <div className="rounded-[16px] border border-line-2 bg-white p-4 text-center shadow-xs">
              <p className="text-[12.5px] text-muted">净额</p>
              <p className={`mt-0.5 text-[26px] font-bold tracking-[-0.02em] tabular-nums ${net >= 0 ? 'text-ink' : 'text-rose-600'}`}>
                {formatMoney(net)}
              </p>
              <p className="mt-0.5 text-[11.5px] text-faint">
                收入 <span className="tabular-nums text-emerald-600">{formatMoney(receipts.total)}</span>
                <span className="mx-1">·</span>
                支出 <span className="tabular-nums text-amber-600">{formatMoney(totalExpense)}</span>
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-[16px] bg-amber-50 p-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-amber-500 text-white"><BanknoteIcon className="size-[22px]" /></span>
              <div className="min-w-0">
                <p className="text-[12.5px] text-amber-700">{periodLabel}总支出</p>
                <p className="truncate text-[20px] font-bold tabular-nums text-amber-600">{formatMoney(totalExpense)}</p>
              </div>
            </div>
          </div>

          {/* 合并流水表「本月交易」：收/支一张表，全部/收入/支出 切换作用其上 */}
          <MonthlyLedgerTable
            receipts={receipts}
            payouts={payouts}
            colorByCase={colorByCase}
            caseOptions={caseOptions}
            referrerById={referrerById}
            receivables={receivables}
            view={ledgerView}
          />
        </div>
      </Card>
    </section>
  )
}
