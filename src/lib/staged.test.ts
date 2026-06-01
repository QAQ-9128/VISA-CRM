import { describe, expect, it } from 'vitest'
import { stageUnitAmount, buildStagePayload, validateStage } from './staged'

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
