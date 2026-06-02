import { useState } from 'react'
import { PlanItemsTable } from './PlanItemsTable'
import { StagedBillingTable } from './StagedBillingTable'
import { useUpdatePaymentPlan } from '../../hooks/queries/usePayments'

/**
 * 客户应收区包装：「分阶段收费」开关 + 据此渲染阶段表(StagedBillingTable)或款项明细(PlanItemsTable)。
 * 开关持久化到 payment_plans.staged_billing（有 plan 时即时写；无 plan 时仅本地态，
 * 首次新增阶段由 StagedBillingTable 懒建 plan 并置 staged_billing=true）。供案件详情与客户页两处复用。
 */
export function ReceivablesItemsArea({
  caseId,
  planId,
  applicantId = null,
  currency = 'AUD',
  staged = false,
}: {
  caseId: string
  planId: string | null
  applicantId?: string | null
  currency?: string
  staged?: boolean
}) {
  const [stagedOn, setStagedOn] = useState(staged)
  const updatePlan = useUpdatePaymentPlan(caseId)

  function toggle(next: boolean) {
    setStagedOn(next)
    if (planId) updatePlan.mutate({ id: planId, patch: { staged_billing: next } })
  }

  return (
    <div className="space-y-3">
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={stagedOn}
          onChange={(e) => toggle(e.target.checked)}
          className="mt-0.5 size-4 rounded border-slate-300 text-brand focus:ring-brand"
        />
        <span>
          分阶段收费
          <span className="mt-0.5 block text-xs text-slate-400">
            按阶段/里程碑收费（阶段名 · 应收金额 · 期数 · 总计），如 意向金 5000×1、递交签证 80000×1。
          </span>
        </span>
      </label>

      {stagedOn ? (
        <StagedBillingTable caseId={caseId} planId={planId} applicantId={applicantId} currency={currency} />
      ) : (
        <PlanItemsTable caseId={caseId} planId={planId} applicantId={applicantId} currency={currency} />
      )}
    </div>
  )
}
