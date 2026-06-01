const round2 = (n: number): number => Math.round(n * 100) / 100

/**
 * 分阶段收费纯逻辑。一个「阶段」= 一行 payment_plan_items：
 *   阶段名 → fee_category（复用，自由文本）
 *   期数   → periods（纯乘数，与分期节点 installments 无关）
 *   总计   → amount_due（行总额）= 应收金额(每期) × 期数
 *   应收金额(每期) → 派生 = amount_due / periods
 * amount_due 仍是行总额，故已付/未付/欠款聚合(getItemPaid/getCaseTotals/selectCustomerDebts)全部不变。
 */

/** 每期应收金额 = 总额 / 期数（期数<1 当作 1，防除零）。 */
export function stageUnitAmount(item: { amount_due: number; periods: number }): number {
  const periods = item.periods >= 1 ? item.periods : 1
  return round2(item.amount_due / periods)
}

export interface StageForm {
  stageName: string
  unitAmount: number
  periods: number
}

/** 表单 → 落库的 item 字段（阶段名写 fee_category，总额 = 应收×期数）。 */
export function buildStagePayload(form: StageForm): { fee_category: string; amount_due: number; periods: number } {
  const periods = form.periods >= 1 ? form.periods : 1
  return {
    fee_category: form.stageName.trim(),
    amount_due: round2(form.unitAmount * periods),
    periods,
  }
}

/** 校验：阶段名必填、期数≥1、金额非负。返回错误文案或 null。 */
export function validateStage(form: StageForm): string | null {
  if (form.stageName.trim() === '') return '请填写阶段名'
  if (!(form.periods >= 1)) return '期数至少为 1'
  if (form.unitAmount < 0) return '应收金额不能为负'
  return null
}
