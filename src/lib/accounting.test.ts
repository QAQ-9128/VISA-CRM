import { describe, expect, it } from 'vitest'
import { computeAccounting, isInstallmentOverdue } from './accounting'

describe('computeAccounting', () => {
  it('按方向汇总并算欠款', () => {
    const a = computeAccounting({ client_total: 1000, company_total: 800 }, [
      { direction: 'from_client', amount: 300 },
      { direction: 'from_client', amount: 200 },
      { direction: 'to_company', amount: 500 },
    ])
    expect(a.clientPaid).toBe(500)
    expect(a.clientOwes).toBe(500)
    expect(a.companyPaid).toBe(500)
    expect(a.companyOwes).toBe(300)
  })

  it('plan 为空时总额按 0', () => {
    const a = computeAccounting(null, [{ direction: 'from_client', amount: 100 }])
    expect(a.clientPaid).toBe(100)
    expect(a.clientOwes).toBe(-100)
  })

  it('金额为字符串也能汇总（numeric 返回 string）', () => {
    const a = computeAccounting({ client_total: '300.50', company_total: null }, [
      { direction: 'from_client', amount: '100.25' },
    ])
    expect(a.clientPaid).toBe(100.25)
    expect(a.clientOwes).toBe(200.25)
  })
})

describe('isInstallmentOverdue', () => {
  const TODAY = new Date(2026, 0, 15)
  it('已付 → false', () => expect(isInstallmentOverdue('2026-01-01', true, TODAY)).toBe(false))
  it('无到期日 → false', () => expect(isInstallmentOverdue(null, false, TODAY)).toBe(false))
  it('过期未付 → true', () => expect(isInstallmentOverdue('2026-01-01', false, TODAY)).toBe(true))
  it('未来未付 → false', () => expect(isInstallmentOverdue('2026-02-01', false, TODAY)).toBe(false))
})
