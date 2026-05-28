import { useCustomerFinance } from '../../hooks/queries/useCustomerFinance'
import { ReceivablesTable } from './ReceivablesTable'
import { ReceiptsList } from './ReceiptsList'
import { ExpensesPanel } from './ExpensesPanel'

/**
 * 客户详情页的「付款 / 收款」区：与 /finance 共用同一份付款数据（一处改另一处同步）。
 * 复用财务页的表格 / 列表 / 支出面板，只把数据限定到当前客户。
 */
export function CustomerPaymentsSection({ customerId }: { customerId: string }) {
  const f = useCustomerFinance(customerId)

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-slate-900">付款 / 收款</h2>

      {f.isPending ? (
        <p className="text-sm text-slate-400">加载付款数据…</p>
      ) : f.isError ? (
        <p className="text-sm text-rose-600">付款数据加载失败，请刷新重试</p>
      ) : f.receivables.length === 0 ? (
        <p className="text-sm text-slate-400">该客户暂无案件，先在上面「案件」里建一个案件再记账。</p>
      ) : (
        <div className="space-y-5">
          <ReceivablesTable rows={f.receivables} totals={f.receivableTotals} />

          <div>
            <p className="mb-2 text-sm font-medium text-slate-600">收款明细</p>
            <ReceiptsList items={f.receipts.items} total={f.receipts.total} />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-600">支出（付主代理 · 付介绍人）</p>
            <ExpensesPanel payouts={f.payouts} caseOptions={f.caseOptions} referrerById={f.referrerById} />
          </div>
        </div>
      )}
    </section>
  )
}
