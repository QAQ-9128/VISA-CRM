import { describe, expect, it } from 'vitest'
import { selectCasePayables } from './casePayables'
import type { Payment, PaymentPlanItem } from '../types/models'

const mkItem = (o: Partial<PaymentPlanItem>): PaymentPlanItem => ({
  id: 'it1', plan_id: 'p1', fee_category: '提名代理费', amount_due: 1000, periods: 1, note: null,
  kind: 'payable', created_at: '2026-06-01', updated_at: '', ...o,
})
const mkPay = (o: Partial<Payment>): Payment => ({
  id: 'x', case_id: 'c1', applicant_id: null, direction: 'to_company', installment_id: null,
  plan_item_id: 'it1', amount: 0, currency: 'AUD', method: 'transfer', paid_at: null, note: null,
  fee_category: null, invoice_path: null, invoice_name: null, from_client_customer_id: null, recorded_by: null, created_at: '', ...o,
})

describe('selectCasePayables（应付款项两步：款项 → 实付，状态 待付款/已付）', () => {
  it('只取 kind=payable 的款项；应收(receivable/null)款项被排除', () => {
    const items = [
      mkItem({ id: 'pay', kind: 'payable', fee_category: '提名代理费', amount_due: 3000 }),
      mkItem({ id: 'rec', kind: null, fee_category: '律师费', amount_due: 9000 }),
    ]
    const r = selectCasePayables(items, [])
    expect(r.lines.map((l) => l.itemId)).toEqual(['pay'])
    expect(r.lines[0].label).toBe('提名代理费')
  })

  it('未记一笔支出 → 待付款(owing)，已付 0、待付 = 应付', () => {
    const r = selectCasePayables([mkItem({ id: 'a', amount_due: 3000 })], [])
    expect(r.lines[0]).toMatchObject({ amount: 3000, paid: 0, unpaid: 3000, status: 'owing' })
  })

  it('记一笔实际支出后 → 已付(settled)，付主代理与付介绍人都计入已付', () => {
    const items = [mkItem({ id: 'a', amount_due: 3000 })]
    const payments = [
      mkPay({ id: 'p1', plan_item_id: 'a', direction: 'to_company', amount: 2000 }),
      mkPay({ id: 'p2', plan_item_id: 'a', direction: 'to_referrer', amount: 1000 }),
    ]
    const r = selectCasePayables(items, payments)
    expect(r.lines[0]).toMatchObject({ paid: 3000, unpaid: 0, status: 'settled' })
  })

  it('部分支付 → 仍 待付款(owing)，待付 = 应付 − 已付', () => {
    const items = [mkItem({ id: 'a', amount_due: 3000 })]
    const r = selectCasePayables(items, [mkPay({ plan_item_id: 'a', direction: 'to_company', amount: 1200 })])
    expect(r.lines[0]).toMatchObject({ paid: 1200, unpaid: 1800, status: 'owing' })
  })

  it('垫付杂项 / 收款不计入应付款项的已付', () => {
    const items = [mkItem({ id: 'a', amount_due: 1000 })]
    const payments = [
      mkPay({ plan_item_id: 'a', direction: 'misc_expense', amount: 1000 }),
      mkPay({ plan_item_id: 'a', direction: 'from_client', amount: 1000 }),
    ]
    expect(selectCasePayables(items, payments).lines[0]).toMatchObject({ paid: 0, status: 'owing' })
  })

  it('合计：应付 / 已付 / 待付 跨款项求和', () => {
    const items = [
      mkItem({ id: 'a', amount_due: 3000, created_at: '2026-06-01' }),
      mkItem({ id: 'b', amount_due: 2000, created_at: '2026-06-02' }),
    ]
    const payments = [mkPay({ plan_item_id: 'a', direction: 'to_company', amount: 3000 })]
    const r = selectCasePayables(items, payments)
    expect(r.lines.map((l) => l.itemId)).toEqual(['a', 'b']) // created_at 升序
    expect(r.totals).toEqual({ payable: 5000, paid: 3000, unpaid: 2000 })
  })

  it('空 → 空行全 0 合计', () => {
    expect(selectCasePayables([], [])).toEqual({ lines: [], totals: { payable: 0, paid: 0, unpaid: 0 } })
  })
})
