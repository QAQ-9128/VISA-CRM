import { describe, expect, it } from 'vitest'
import { computeAccounting, isInstallmentOverdue, payableStatus } from './accounting'

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

  it('介绍人应付：Σ to_referrer，还欠 = referrer_total − 已付', () => {
    const a = computeAccounting({ client_total: 1000, company_total: 800, referrer_total: 500 }, [
      { direction: 'to_referrer', amount: 200 },
      { direction: 'to_company', amount: 100 },
    ])
    expect(a.referrerPaid).toBe(200)
    expect(a.referrerOwes).toBe(300)
    // 未设 referrer_total（旧计划）→ 应付按 0，已付仍真实汇总
    const b = computeAccounting({ client_total: 0, company_total: 0 }, [
      { direction: 'to_referrer', amount: 150 },
    ])
    expect(b.referrerPaid).toBe(150)
    expect(b.referrerOwes).toBe(-150)
  })

  it('金额为字符串也能汇总（numeric 返回 string）', () => {
    const a = computeAccounting({ client_total: '300.50', company_total: null }, [
      { direction: 'from_client', amount: '100.25' },
    ])
    expect(a.clientPaid).toBe(100.25)
    expect(a.clientOwes).toBe(200.25)
  })
})

describe('payableStatus（应付行状态派生）', () => {
  it('无应付总额且未付 → 未设(unset)', () => {
    expect(payableStatus(null, 0, 0)).toBe('unset')
    expect(payableStatus(0, 0, 0)).toBe('unset')
  })
  it('付清(还差≤0) → 已结清(settled)', () => {
    expect(payableStatus(1000, 1000, 0)).toBe('settled')
    expect(payableStatus(1000, 1200, -200)).toBe('settled')
  })
  it('还差>0 → 欠(owing)', () => {
    expect(payableStatus(1000, 300, 700)).toBe('owing')
  })
  it('未设总额但已有付款 → 不算未设（已付了就要显示）', () => {
    expect(payableStatus(null, 150, -150)).toBe('settled')
  })
})

describe('isInstallmentOverdue', () => {
  const TODAY = new Date(2026, 0, 15)
  it('已付 → false', () => expect(isInstallmentOverdue('2026-01-01', true, TODAY)).toBe(false))
  it('无到期日 → false', () => expect(isInstallmentOverdue(null, false, TODAY)).toBe(false))
  it('过期未付 → true', () => expect(isInstallmentOverdue('2026-01-01', false, TODAY)).toBe(true))
  it('未来未付 → false', () => expect(isInstallmentOverdue('2026-02-01', false, TODAY)).toBe(false))
})
