import { describe, expect, it } from 'vitest'
import { selectCaseExpenses } from './caseExpenses'
import type { Payment } from '../types/models'

const mkPayment = (o: Partial<Payment>): Payment => ({
  id: 'pay1', case_id: 'c1', applicant_id: null, direction: 'from_client', installment_id: null, plan_item_id: null, amount: 0,
  currency: 'AUD', method: 'transfer', paid_at: null, note: null, fee_category: null, invoice_path: null, invoice_name: null,
  from_client_customer_id: null, recorded_by: null, created_at: '', ...o,
})

describe('selectCaseExpenses（案件支出区：三类实付流水，与财务账目同口径）', () => {
  it('只取支出方向（付主代理/付介绍人/垫付杂项），排除 from_client；按日期倒序、无日期排最后', () => {
    const pays = [
      mkPayment({ id: 'in', direction: 'from_client', amount: 9000, paid_at: '2026-06-05' }),
      mkPayment({ id: 'co', direction: 'to_company', amount: 3000, paid_at: '2026-06-01' }),
      mkPayment({ id: 're', direction: 'to_referrer', amount: 800, paid_at: '2026-06-03' }),
      mkPayment({ id: 'mi', direction: 'misc_expense', amount: 350, paid_at: null, note: '体检费垫付' }),
    ]
    const e = selectCaseExpenses(pays)
    expect(e.items.map((p) => p.id)).toEqual(['re', 'co', 'mi'])
  })

  it('三类小计 + 合计；负数（冲红）夹 0 不计入合计、明细保留（与月度账目同口径）', () => {
    const pays = [
      mkPayment({ id: 'co', direction: 'to_company', amount: 3000, paid_at: '2026-06-01' }),
      mkPayment({ id: 'co2', direction: 'to_company', amount: -200, paid_at: '2026-06-02' }),
      mkPayment({ id: 're', direction: 'to_referrer', amount: 800.5, paid_at: '2026-06-03' }),
      mkPayment({ id: 'mi', direction: 'misc_expense', amount: 350, paid_at: '2026-06-04' }),
    ]
    const e = selectCaseExpenses(pays)
    expect(e.totals).toEqual({ toCompany: 3000, toReferrer: 800.5, misc: 350, total: 4150.5 })
    expect(e.items).toHaveLength(4)
  })

  it('空数据 → 空明细全 0 合计，不报错', () => {
    expect(selectCaseExpenses([])).toEqual({
      items: [],
      totals: { toCompany: 0, toReferrer: 0, misc: 0, total: 0 },
    })
  })
})
