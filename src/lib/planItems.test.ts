import { describe, expect, it } from 'vitest'
import { getItemPaid, getItemUnpaid, getCaseTotals, itemHasPayments, isPayableItem } from './planItems'
import type { Payment, PaymentPlanItem } from '../types/models'

const mkItem = (o: Partial<PaymentPlanItem>): PaymentPlanItem => ({
  id: 'it1', plan_id: 'p1', fee_category: '律师费', amount_due: 1000, periods: 1, note: null,
  kind: null, expense_direction: null, is_shared: false, created_at: '', updated_at: '', ...o,
})
const mkPay = (o: Partial<Payment>): Payment => ({
  id: 'pay1', case_id: 'c1', applicant_id: null, direction: 'from_client', installment_id: null,
  plan_item_id: 'it1', amount: 0, currency: 'AUD', method: 'transfer', paid_at: null, note: null,
  fee_category: null, invoice_path: null, invoice_name: null, from_client_customer_id: null, is_shared: false, recorded_by: null, created_at: '', ...o,
})

describe('getItemPaid', () => {
  it('只汇总归属该 item 的 from_client 收款；其它 item / 未归类(null) / 付主代理 都不计', () => {
    const payments = [
      mkPay({ id: 'a', plan_item_id: 'it1', amount: 800 }),
      mkPay({ id: 'b', plan_item_id: 'it1', amount: 200 }),
      mkPay({ id: 'c', plan_item_id: 'it2', amount: 999 }), // 别的 item
      mkPay({ id: 'd', plan_item_id: null, amount: 500 }), // 未归类 → 不计
      mkPay({ id: 'e', plan_item_id: 'it1', direction: 'to_company', amount: 700 }), // 付主代理 → 不计
    ]
    expect(getItemPaid('it1', payments)).toBe(1000)
  })
  it('无关联收款 → 0', () => {
    expect(getItemPaid('itX', [mkPay({ plan_item_id: 'it1', amount: 100 })])).toBe(0)
  })
})

describe('getItemUnpaid', () => {
  it('= amount_due − 已付', () => {
    const payments = [mkPay({ plan_item_id: 'it1', amount: 300 })]
    expect(getItemUnpaid(mkItem({ id: 'it1', amount_due: 1000 }), payments)).toBe(700)
  })
  it('超付为负（不夹 0，交由展示层处理）', () => {
    expect(getItemUnpaid(mkItem({ id: 'it1', amount_due: 100 }), [mkPay({ plan_item_id: 'it1', amount: 150 })])).toBe(-50)
  })
})

describe('getCaseTotals', () => {
  it('多条 items 汇总总应收/总已付/总未付', () => {
    const items = [
      mkItem({ id: 'law', amount_due: 1000 }),
      mkItem({ id: 'copy', amount_due: 2000 }),
    ]
    const payments = [
      mkPay({ plan_item_id: 'law', amount: 800 }),
      mkPay({ plan_item_id: 'copy', amount: 200 }),
      mkPay({ plan_item_id: null, amount: 999 }), // 未归类 → 不计入
    ]
    expect(getCaseTotals(items, payments)).toEqual({ totalDue: 3000, totalPaid: 1000, totalUnpaid: 2000 })
  })
  it('无 items → 全 0', () => {
    expect(getCaseTotals([], [mkPay({ amount: 100 })])).toEqual({ totalDue: 0, totalPaid: 0, totalUnpaid: 0 })
  })
  it('迁移后旧数据等价：单条默认款项(应收=client_total)，收款全归该款项 → 与原 应收/已付/未付 一致', () => {
    const items = [mkItem({ id: 'def', fee_category: '律师费', amount_due: 5000 })]
    const payments = [mkPay({ plan_item_id: 'def', amount: 3000 })]
    expect(getCaseTotals(items, payments)).toEqual({ totalDue: 5000, totalPaid: 3000, totalUnpaid: 2000 })
  })
})

describe('isPayableItem（应付款项鉴别）', () => {
  it('kind=payable → true；null/receivable/缺省 → false', () => {
    expect(isPayableItem(mkItem({ kind: 'payable' }))).toBe(true)
    expect(isPayableItem(mkItem({ kind: null }))).toBe(false)
    expect(isPayableItem(mkItem({ kind: 'receivable' }))).toBe(false)
    expect(isPayableItem({})).toBe(false)
  })
})

describe('itemHasPayments（删除守卫）', () => {
  it('该 item 名下有收款 → true（禁止删除）', () => {
    expect(itemHasPayments('it1', [mkPay({ plan_item_id: 'it1', amount: 100 })])).toBe(true)
  })
  it('无收款 → false（可删除）', () => {
    expect(itemHasPayments('it1', [mkPay({ plan_item_id: 'it2', amount: 100 })])).toBe(false)
    expect(itemHasPayments('it1', [])).toBe(false)
  })
})
