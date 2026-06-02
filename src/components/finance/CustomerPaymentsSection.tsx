import { useMemo, useState } from 'react'
import { useCustomerFinance } from '../../hooks/queries/useCustomerFinance'
import { selectCasePaymentColors } from '../../lib/finance'
import type { LedgerView } from '../../lib/finance'
import { buildFinanceTableRows } from '../../lib/financeRows'
import { formatMoney } from '../../lib/money'
import { Card } from '../ui/Card'
import { FinanceReceivablesTable } from './FinanceReceivablesTable'
import { MonthlyLedgerTable } from './MonthlyLedgerTable'

const VIEWS: LedgerView[] = ['all', 'income', 'expense']

/**
 * 客户详情页的「付款 / 收款」区：客户级（跨该客户名下案件）双流账目视图。
 * 与 /finance 共用同一份付款数据（同查询键 → 一处改两处刷新），并复用财务页同款组件：
 *  - 应收富表 FinanceReceivablesTable（每行「记账」菜单 + 分期进度 + 下一期 + 状态）
 *  - 合并流水 MonthlyLedgerTable（收/支一张表，内置「记收款 / 加支出」入口）
 * 不新建平行表 / 不另起数据路径；金额口径＝财务页 / 案件付款一致。
 */
export function CustomerPaymentsSection({ customerId }: { customerId: string }) {
  const f = useCustomerFinance(customerId)
  const [view, setView] = useState<LedgerView>('all')
  const colorByCase = useMemo(() => selectCasePaymentColors(f.receivables), [f.receivables])
  const rows = useMemo(
    () => buildFinanceTableRows(f.receivables, f.instByPlan, f.caseNumberByCaseId),
    [f.receivables, f.instByPlan, f.caseNumberByCaseId],
  )
  const t = f.receivableTotals
  const paidOut = f.payouts.toCompanyTotal + f.payouts.toReferrerTotal

  if (f.isPending) return <p className="text-sm text-faint">加载付款数据…</p>
  if (f.isError) return <p className="text-sm text-rose-600">付款数据加载失败，请刷新重试</p>
  if (f.receivables.length === 0)
    return <p className="text-sm text-faint">该客户暂无案件，先在上面「案件」里建一个案件再记账。</p>

  return (
    <div className="space-y-4">
      {/* ① 双流摘要：总应收 / 已收 / 未收 / 已付出（付主代理＋付介绍人） */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: '总应收', value: formatMoney(t.receivable), cls: 'text-ink', sub: '' },
          { label: '已收', value: formatMoney(t.paid), cls: 'text-emerald-600', sub: '' },
          { label: '未收', value: formatMoney(t.unpaid), cls: 'text-rose-600', sub: '' },
          {
            label: '已付出',
            value: formatMoney(paidOut),
            cls: 'text-amber-600',
            sub: `主代理 ${formatMoney(f.payouts.toCompanyTotal)} · 介绍人 ${formatMoney(f.payouts.toReferrerTotal)}`,
          },
        ].map((m) => (
          <div key={m.label} className="rounded-[14px] border border-line-2 bg-surface-2 px-4 py-3">
            <div className="text-[12px] text-muted">{m.label}</div>
            <div className={`mt-1 text-[18px] font-bold tabular-nums ${m.cls}`}>{m.value}</div>
            {m.sub && <div className="mt-0.5 text-[11px] text-faint">{m.sub}</div>}
          </div>
        ))}
      </div>

      {/* ② 应收 / 分期进度：财务页同款富表，每行「记账」菜单（记应收 / 记收款 / 创建付款计划 / 付主代理 / 付介绍人） */}
      <Card>
        <h3 className="mb-3 text-base font-bold text-ink">应收 / 分期进度</h3>
        <FinanceReceivablesTable rows={rows} totals={t} />
      </Card>

      {/* ③ 收付款明细：合并流水（收/支一张表），表头内置「记收款 / 加支出」入口 */}
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-bold text-ink">收付款明细</h3>
          <div className="inline-flex gap-1 rounded-full bg-surface-2 p-1">
            {VIEWS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                  view === v ? 'bg-white text-brand shadow-xs' : 'text-muted hover:text-body'
                }`}
              >
                {v === 'all' ? '全部' : v === 'income' ? '收入' : '支出'}
              </button>
            ))}
          </div>
        </div>
        <MonthlyLedgerTable
          receipts={f.receipts}
          payouts={f.payouts}
          colorByCase={colorByCase}
          caseOptions={f.caseOptions}
          referrerById={f.referrerById}
          receivables={f.receivables}
          view={view}
        />
      </Card>
    </div>
  )
}
