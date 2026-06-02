import { describe, expect, it } from 'vitest'
import {
  paymentItemsCsv,
  planItemRowStatus,
  selectPaymentItemRows,
  selectRecentReceipts,
  sumPaymentItemRows,
} from './paymentTab'
import type { Installment, Payment, PaymentPlanItem } from '../types/models'

const item = (over: Partial<PaymentPlanItem> = {}): PaymentPlanItem =>
  ({ id: 'i1', plan_id: 'p', fee_category: '服务费', amount_due: 1000, periods: 1, note: null, ...over }) as PaymentPlanItem
const pay = (over: Partial<Payment> = {}): Payment =>
  ({
    id: 'pay',
    case_id: 'c',
    direction: 'from_client',
    plan_item_id: null,
    installment_id: null,
    amount: 0,
    method: 'transfer',
    paid_at: null,
    created_at: '2026-01-01T00:00:00Z',
    fee_category: null,
    ...over,
  }) as Payment

describe('planItemRowStatus（按已收 vs 应收派生）', () => {
  it('已收≥应收 → 已结清', () => {
    expect(planItemRowStatus(1000, 1000)).toEqual({ kind: 'settled', label: '已结清' })
    expect(planItemRowStatus(1000, 1200).kind).toBe('settled') // 超付仍结清
  })
  it('0<已收<应收 → 分期中', () => {
    expect(planItemRowStatus(1000, 400)).toEqual({ kind: 'partial', label: '分期中' })
  })
  it('已收=0 → 未开始', () => {
    expect(planItemRowStatus(1000, 0)).toEqual({ kind: 'notStarted', label: '未开始' })
  })
  it('应收=0（未设）→ 未开始，不误判已结清', () => {
    expect(planItemRowStatus(0, 0).kind).toBe('notStarted')
  })
})

describe('selectPaymentItemRows', () => {
  it('每项 应收/已收/未收/状态，只计 from_client 且归属该项的收款', () => {
    const items = [item({ id: 'i1', amount_due: 1000 }), item({ id: 'i2', fee_category: '签证递交', amount_due: 2000, periods: 3 })]
    const payments = [
      pay({ id: 'a', plan_item_id: 'i1', amount: 1000 }), // i1 付清
      pay({ id: 'b', plan_item_id: 'i2', amount: 500 }), // i2 部分
      pay({ id: 'c', plan_item_id: 'i2', amount: 0, direction: 'to_company' }), // 不计（付主代理）
      pay({ id: 'd', plan_item_id: null, amount: 999 }), // 未归类不计入任何项
    ]
    const rows = selectPaymentItemRows(items, payments)
    expect(rows[0]).toMatchObject({ name: '服务费', due: 1000, paid: 1000, unpaid: 0, status: { label: '已结清' } })
    expect(rows[1]).toMatchObject({ name: '签证递交', due: 2000, paid: 500, unpaid: 1500, periods: 3, status: { label: '分期中' } })
  })
  it('空项 → 空数组', () => {
    expect(selectPaymentItemRows([], [])).toEqual([])
  })
})

describe('sumPaymentItemRows', () => {
  it('合计 应收/已收，未收=应收−已收（夹 0）', () => {
    const rows = selectPaymentItemRows(
      [item({ id: 'i1', amount_due: 1000 }), item({ id: 'i2', amount_due: 2000 })],
      [pay({ plan_item_id: 'i1', amount: 1000 }), pay({ plan_item_id: 'i2', amount: 500 })],
    )
    expect(sumPaymentItemRows(rows)).toEqual({ due: 3000, paid: 1500, unpaid: 1500 })
  })
})

describe('selectRecentReceipts', () => {
  const items = [item({ id: 'i1', fee_category: '服务费' })]
  const insts: Installment[] = [
    { id: 'ins1', payment_plan_id: 'p', label: '首期', due_date: '2026-03-01', amount: 500, is_paid: false, paid_at: null } as Installment,
  ]
  it('仅 from_client、按日期倒序、映射款项与分期名', () => {
    const payments = [
      pay({ id: 'a', paid_at: '2026-02-01', amount: 500, plan_item_id: 'i1', installment_id: 'ins1' }),
      pay({ id: 'b', paid_at: '2026-04-01', amount: 700, plan_item_id: 'i1' }),
      pay({ id: 'x', paid_at: '2026-05-01', amount: 9, direction: 'to_company' }), // 排除
    ]
    const rows = selectRecentReceipts(payments, items, insts)
    expect(rows.map((r) => r.id)).toEqual(['b', 'a']) // 倒序，无 to_company
    expect(rows[0]).toMatchObject({ amount: 700, itemName: '服务费', installmentLabel: null, methodLabel: '转账' })
    expect(rows[1]).toMatchObject({ itemName: '服务费', installmentLabel: '首期' })
  })
  it('未归类收款回落 payment.fee_category；无分期 → null；limit 生效', () => {
    const payments = [
      pay({ id: 'a', paid_at: '2026-01-03', amount: 1, fee_category: '翻译费' }),
      pay({ id: 'b', paid_at: '2026-01-02', amount: 2 }),
      pay({ id: 'c', paid_at: '2026-01-01', amount: 3 }),
    ]
    const rows = selectRecentReceipts(payments, items, insts, 2)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ id: 'a', itemName: '翻译费', installmentLabel: null })
  })
})

describe('paymentItemsCsv', () => {
  it('表头 + 各行 + 合计行；含逗号的项目名加引号', () => {
    const rows = selectPaymentItemRows(
      [item({ id: 'i1', fee_category: '服务费,加急', amount_due: 1000 })],
      [pay({ plan_item_id: 'i1', amount: 400 })],
    )
    const csv = paymentItemsCsv(rows)
    const lines = csv.split('\n')
    expect(lines[0]).toBe('项目,应收,已收,未收,状态')
    expect(lines[1]).toBe('"服务费,加急",1000,400,600,分期中')
    expect(lines[2]).toBe('合计,1000,400,600,')
  })
})
