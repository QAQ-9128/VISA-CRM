import { useMemo, useState } from 'react'
import { useFinance } from '../../hooks/queries/useFinance'
import { LoadingBlock, ErrorBlock } from '../../components/ui/states'
import { ReceivablesTable } from '../../components/finance/ReceivablesTable'
import { ReceiptsList } from '../../components/finance/ReceiptsList'
import { ExpensesPanel } from '../../components/finance/ExpensesPanel'
import { MonthSelector } from '../../components/finance/MonthSelector'
import { sumFinanceReceivables } from '../../lib/finance'
import { formatMoney } from '../../lib/money'
import { currentMonth } from '../../lib/month'

export function FinancePage() {
  const [month, setMonth] = useState<string | null>(() => currentMonth())
  const [showAllReceivables, setShowAllReceivables] = useState(false)
  const {
    isPending,
    isError,
    receivables,
    recentCaseIds,
    receipts,
    payouts,
    caseOptions,
    referrerById,
  } = useFinance(month)

  // 区域 1「近期案件」：只取最近活动的 5 个案件的应收行，按近期顺序分组
  const recentRows = useMemo(() => {
    const order = new Map(recentCaseIds.map((id, i) => [id, i]))
    return receivables.filter((r) => order.has(r.caseId)).sort((a, b) => order.get(a.caseId)! - order.get(b.caseId)!)
  }, [receivables, recentCaseIds])

  const shownRows = showAllReceivables ? receivables : recentRows
  const shownTotals = useMemo(() => sumFinanceReceivables(shownRows), [shownRows])

  // 区域 2 月度总计条
  const totalExpense = useMemo(
    () => Math.round((payouts.toCompanyTotal + payouts.toReferrerTotal) * 100) / 100,
    [payouts.toCompanyTotal, payouts.toReferrerTotal],
  )
  const net = Math.round((receipts.total - totalExpense) * 100) / 100
  const periodLabel = month ? '本月' : '全部'

  if (isPending) return <LoadingBlock />
  if (isError) return <ErrorBlock error={new Error('财务数据加载失败，请刷新重试')} />

  const hiddenCount = receivables.length - recentRows.length

  return (
    <section className="mx-auto max-w-4xl space-y-8">
      <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">财务</h1>

      {/* ── 区域 1：近期案件（现状快照，不受月份筛选影响）─────────────────── */}
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">近期案件</h2>
          <span className="text-xs text-slate-400">这里是当下应收状态，与下方月份筛选无关</span>
        </div>

        {shownRows.length === 0 ? (
          <p className="py-2 text-sm text-slate-400">暂无案件（先在客户下建案件，再来这里记账）</p>
        ) : (
          <>
            <ReceivablesTable rows={shownRows} totals={shownTotals} />
            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAllReceivables((v) => !v)}
                className="text-sm font-medium text-indigo-600 hover:underline"
              >
                {showAllReceivables ? '收起' : `查看全部应收（共 ${receivables.length} 行，还有 ${hiddenCount} 行）`}
              </button>
            )}
          </>
        )}
      </section>

      {/* ── 区域 2：月度账目（按月查收付明细）─────────────────────────────── */}
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">月度账目</h2>
          <MonthSelector value={month} onChange={setMonth} />
        </div>

        {/* 月度总计条 */}
        <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3 text-center text-xs">
          <div>
            <p className="text-slate-500">{periodLabel}总收款</p>
            <p className="mt-0.5 text-sm font-semibold text-emerald-700">{formatMoney(receipts.total)}</p>
          </div>
          <div>
            <p className="text-slate-500">{periodLabel}总支出</p>
            <p className="mt-0.5 text-sm font-semibold text-amber-700">{formatMoney(totalExpense)}</p>
          </div>
          <div>
            <p className="text-slate-500">净额</p>
            <p className={`mt-0.5 text-sm font-semibold ${net >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
              {formatMoney(net)}
            </p>
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">收款明细（客户付款）</h3>
          <ReceiptsList items={receipts.items} total={receipts.total} />
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">支出 / 付款（付主代理 · 付介绍人）</h3>
          <ExpensesPanel payouts={payouts} caseOptions={caseOptions} referrerById={referrerById} />
        </div>
      </section>
    </section>
  )
}
