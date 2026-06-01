import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../ui/Button'
import { PaymentPlanForm } from './PaymentPlanForm'
import { InstallmentsPanel } from './InstallmentsPanel'
import { PaymentsPanel } from './PaymentsPanel'
import { ReceivablesItemsArea } from '../finance/ReceivablesItemsArea'
import { usePaymentPlan, usePaymentsByCase } from '../../hooks/queries/usePayments'
import { computeAccounting } from '../../lib/accounting'
import { formatMoney } from '../../lib/money'

function FlowCard({
  title,
  total,
  paid,
  owes,
  totalLabel,
  paidLabel,
  currency,
}: {
  title: string
  total: number | string | null
  paid: number
  owes: number
  totalLabel: string
  paidLabel: string
  currency: string
}) {
  const settled = owes <= 0
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-500">{title}</p>
      <p className={`mt-1 text-2xl font-semibold ${settled ? 'text-emerald-600' : 'text-rose-600'}`}>
        {settled ? '已结清' : formatMoney(owes, currency)}
      </p>
      <p className="mt-1 text-xs text-slate-400">
        {totalLabel} {formatMoney(total, currency)} · {paidLabel} {formatMoney(paid, currency)}
      </p>
    </div>
  )
}

/** 案件付款区：双流账目卡片 + 付款计划 + 分期 + 收付款记录。 */
export function PaymentsSection({
  caseId,
  currency = 'AUD',
  syncTracking = true,
  customerId,
}: {
  caseId: string
  currency?: string
  /** 财务合并核算：true = 案件级合并账单（此处管理）；false = 按申请人分开（去客户/财务页管理）。进度追踪与此无关，始终同步。 */
  syncTracking?: boolean
  customerId?: string
}) {
  const planQuery = usePaymentPlan(caseId)
  const payments = usePaymentsByCase(caseId)
  const [editingPlan, setEditingPlan] = useState(false)
  const [creatingPlan, setCreatingPlan] = useState(false)

  const plan = planQuery.data
  const cur = plan?.currency || currency
  const acct = computeAccounting(plan, payments.data ?? [])

  // 财务分开核算：账单按申请人分开，引导到客户/财务页管理（避免在此误建合并账单）
  if (!syncTracking) {
    return (
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">付款</h2>
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-4 text-sm text-slate-600">
          本案件「按申请人分开记账」。请到
          {customerId ? (
            <Link to={`/customers/${customerId}`} className="mx-1 text-indigo-600 hover:underline">
              客户档案
            </Link>
          ) : (
            <span className="mx-1">客户档案</span>
          )}
          或
          <Link to="/finance" className="mx-1 text-indigo-600 hover:underline">
            财务页
          </Link>
          按申请人管理应收 / 收款。
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <h2 className="text-base font-semibold text-slate-900">付款（双流账目）</h2>

      {planQuery.isPending ? (
        <p className="text-sm text-slate-400">加载付款计划…</p>
      ) : (
        <>
          {/* 客户应收：按费用类别拆分的款项明细（每条独立 应收/已付/未付）。无计划时新增款项会自动建计划 */}
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-medium text-slate-600">客户应收 · 款项明细</p>
            <ReceivablesItemsArea
              caseId={caseId}
              planId={plan?.id ?? null}
              currency={cur}
              staged={plan?.staged_billing ?? false}
            />
          </div>

          {/* 主代理（双流另一侧），保持原结构；无计划时可创建以设置主代理应付 */}
          {plan ? (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FlowCard
                  title="你欠主代理"
                  total={plan.company_total}
                  paid={acct.companyPaid}
                  owes={acct.companyOwes}
                  totalLabel="应付"
                  paidLabel="已付"
                  currency={cur}
                />
              </div>

              {editingPlan ? (
                <PaymentPlanForm
                  caseId={caseId}
                  initial={plan}
                  defaultCurrency={cur}
                  onDone={() => setEditingPlan(false)}
                />
              ) : (
                <Button variant="ghost" onClick={() => setEditingPlan(true)}>
                  编辑主代理应付 / 货币
                </Button>
              )}

              <InstallmentsPanel planId={plan.id} currency={cur} />
              <PaymentsPanel caseId={caseId} planId={plan.id} currency={cur} />
            </>
          ) : creatingPlan ? (
            <PaymentPlanForm caseId={caseId} defaultCurrency={currency} onDone={() => setCreatingPlan(false)} />
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-4">
              <span className="text-sm text-slate-500">如需登记「付主代理」账目，可创建付款计划</span>
              <Button variant="secondary" onClick={() => setCreatingPlan(true)}>创建付款计划</Button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
