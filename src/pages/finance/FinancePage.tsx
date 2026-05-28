import { useFinance } from '../../hooks/queries/useFinance'
import { LoadingBlock, ErrorBlock } from '../../components/ui/states'
import { ReceivablesTable } from '../../components/finance/ReceivablesTable'
import { ReceiptsList } from '../../components/finance/ReceiptsList'
import { ExpensesPanel } from '../../components/finance/ExpensesPanel'

export function FinancePage() {
  const { isPending, isError, receivables, receivableTotals, receipts, payouts, caseOptions, referrerById } =
    useFinance()

  if (isPending) return <LoadingBlock />
  if (isError) return <ErrorBlock error={new Error('财务数据加载失败，请刷新重试')} />

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">财务</h1>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">客户应收汇总（按案件，AUD）</h2>
        <ReceivablesTable rows={receivables} totals={receivableTotals} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">收款明细（客户付款）</h2>
        <ReceiptsList items={receipts.items} total={receipts.total} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">支出 / 付款（付主代理 · 付介绍人）</h2>
        <ExpensesPanel payouts={payouts} caseOptions={caseOptions} referrerById={referrerById} />
      </section>
    </section>
  )
}
