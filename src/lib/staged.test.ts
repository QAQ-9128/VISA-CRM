import { describe, expect, it } from 'vitest'
import { stageUnitAmount, buildStagePayload, validateStage, stageUnitLine, stageDisplay } from './staged'
import type { Payment, PaymentPlanItem } from '../types/models'

const mkItem = (o: Partial<PaymentPlanItem>): PaymentPlanItem => ({
  id: 'it1', plan_id: 'p1', fee_category: '阶段', amount_due: 0, periods: 1, note: null, created_at: '', updated_at: '', ...o,
})
const mkPay = (o: Partial<Payment>): Payment => ({
  id: 'pay1', case_id: 'c1', applicant_id: null, direction: 'from_client', installment_id: null, plan_item_id: 'it1',
  amount: 0, currency: 'AUD', method: 'transfer', paid_at: null, note: null, fee_category: null, invoice_path: null,
  invoice_name: null, recorded_by: null, created_at: '', ...o,
})

describe('stageUnitAmount（应收金额=每期=总额/期数，派生）', () => {
  it('期数>1 → 平均到每期', () => {
    expect(stageUnitAmount({ amount_due: 9000, periods: 3 })).toBe(3000)
  })
  it('期数=1 → 等于总额', () => {
    expect(stageUnitAmount({ amount_due: 5000, periods: 1 })).toBe(5000)
  })
  it('期数 0/缺失 → 当作 1（防除零）', () => {
    expect(stageUnitAmount({ amount_due: 5000, periods: 0 })).toBe(5000)
  })
  it('四舍五入到分', () => {
    expect(stageUnitAmount({ amount_due: 100, periods: 3 })).toBe(33.33)
  })
})

describe('buildStagePayload（阶段名→fee_category；总额=应收×期数）', () => {
  it('意向金 5000×1', () => {
    expect(buildStagePayload({ stageName: ' 意向金 ', unitAmount: 5000, periods: 1 })).toEqual({
      fee_category: '意向金',
      amount_due: 5000,
      periods: 1,
    })
  })
  it('递交签证 80000×1', () => {
    expect(buildStagePayload({ stageName: '递交签证', unitAmount: 80000, periods: 1 })).toEqual({
      fee_category: '递交签证',
      amount_due: 80000,
      periods: 1,
    })
  })
  it('多期：3000×4 → 总额 12000', () => {
    expect(buildStagePayload({ stageName: '学费', unitAmount: 3000, periods: 4 })).toEqual({
      fee_category: '学费',
      amount_due: 12000,
      periods: 4,
    })
  })
})

describe('stageUnitLine（每期 X · 共 N 期 小行）', () => {
  it('多期', () => {
    expect(stageUnitLine(40000, 2)).toBe('每期 AUD 40,000.00 · 共 2 期')
  })
  it('单期也照常显示（默认）', () => {
    expect(stageUnitLine(1, 1)).toBe('每期 AUD 1.00 · 共 1 期')
  })
})

describe('stageDisplay（阶段紧凑行展示数据）', () => {
  it('递交签证 40000×2，已收 40000 → 已付/未付正确、含每期行、期数>1 显示标签', () => {
    const item = mkItem({ id: 's1', fee_category: '递交签证', amount_due: 80000, periods: 2 })
    const d = stageDisplay(item, [mkPay({ plan_item_id: 's1', amount: 40000 })])
    expect(d).toMatchObject({
      name: '递交签证', periods: 2, unitAmount: 40000, receivable: 80000, paid: 40000, unpaid: 40000,
      unitLine: '每期 AUD 40,000.00 · 共 2 期', showPeriodsTag: true,
    })
  })
  it('意向金 5000×1，已收 5000 → 已付清(unpaid=0)、期数=1 不显示分N期标签', () => {
    const item = mkItem({ id: 's2', fee_category: '意向金', amount_due: 5000, periods: 1 })
    const d = stageDisplay(item, [mkPay({ plan_item_id: 's2', amount: 5000 })])
    expect(d).toMatchObject({ paid: 5000, unpaid: 0, showPeriodsTag: false })
    expect(d.unitLine).toBe('每期 AUD 5,000.00 · 共 1 期')
  })
})

describe('validateStage（阶段名必填 / 期数≥1 / 金额非负）', () => {
  it('阶段名空 → 报错', () => {
    expect(validateStage({ stageName: '  ', unitAmount: 5000, periods: 1 })).toBe('请填写阶段名')
  })
  it('期数 <1 → 报错', () => {
    expect(validateStage({ stageName: '意向金', unitAmount: 5000, periods: 0 })).toBe('期数至少为 1')
  })
  it('金额为负 → 报错', () => {
    expect(validateStage({ stageName: '意向金', unitAmount: -1, periods: 1 })).toBe('应收金额不能为负')
  })
  it('合法 → null', () => {
    expect(validateStage({ stageName: '意向金', unitAmount: 5000, periods: 1 })).toBeNull()
  })
})
