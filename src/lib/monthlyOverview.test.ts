import { describe, expect, it } from 'vitest'
import {
  selectMonthlyOverview,
  groupPayouts,
  monthTitle,
  formatMonthDay,
  receiptSubtitle,
  payoutDisplayName,
  payoutSubtitle,
} from './monthlyOverview'
import { selectFinanceReceipts, selectFinancePayouts } from './finance'
import type { FinanceReceipts, FinancePayouts, PayoutItem } from './finance'
import type { Case, Customer, Payment, Referrer } from '../types/models'

// 最小工厂（与 finance.test.ts 同款）
const mkCase = (o: Partial<Case>): Case => ({
  id: 'c1', case_number: '00000001', customer_id: 'cu1', visa_subclass: '482', visa_stream: null, current_stage: 'visa_lodged',
  currency: 'AUD', sync_tracking: true, trt_reminder_enabled: false, parent_case_id: null, parent_sync_progress: false, destination_country: 'Australia', sponsor_position: null, sponsor_employer_id: null, assigned_to: null, created_by: null,
  is_archived: false, created_at: '', updated_at: '', ...o,
})
const mkCustomer = (o: Partial<Customer>): Customer => ({
  id: 'cu1', full_name: '张三', is_starred: false, client_source: null, primary_applicant_id: null,
  relationship_to_primary: null, birth_date: null, gender: null, passport_no: null, nationality: null, phone: null,
  email: null, wechat: null, address: null, sponsor_employer_id: null, sponsor_position: null, referrer_id: null, notes: null,
  assigned_to: null, created_by: null, is_archived: false, created_at: '', updated_at: '', ...o,
})
const mkPayment = (o: Partial<Payment>): Payment => ({
  id: 'pay1', case_id: 'c1', applicant_id: null, direction: 'from_client', installment_id: null, plan_item_id: null, amount: 0,
  currency: 'AUD', method: 'transfer', paid_at: null, note: null, fee_category: null, invoice_path: null, invoice_name: null,
  from_client_customer_id: null, recorded_by: null, created_at: '', ...o,
})
const mkReferrer = (o: Partial<Referrer>): Referrer => ({
  id: 'r1', name: '王介绍', contact_phone: null, contact_email: null, notes: null,
  is_archived: false, created_by: null, created_at: '', updated_at: '', ...o,
})

const receipts = (total: number): FinanceReceipts => ({ items: [], total })
const payouts = (toCompanyTotal: number, toReferrerTotal: number): FinancePayouts => ({
  items: [], toCompanyTotal, toReferrerTotal,
})
const mkPayout = (o: Partial<PayoutItem>): PayoutItem => ({
  paymentId: 'x1', direction: 'to_company', amount: 0, method: 'transfer', customerName: '张三',
  customerId: 'cu1', referrerName: null, paidAt: null, note: null, caseId: 'c1', ...o,
})

describe('selectMonthlyOverview · 恒等式与对账', () => {
  it('净额 = 收入小计 − 付主代理 − 付介绍人（双流恒等）', () => {
    const o = selectMonthlyOverview(receipts(22200), payouts(4200, 2300))
    expect(o.income).toBe(22200)
    expect(o.toCompany).toBe(4200)
    expect(o.toReferrer).toBe(2300)
    expect(o.expense).toBe(6500)
    expect(o.net).toBe(15700)
  })

  it('浮点：0.1+0.2 类小数 round2 后无尾差', () => {
    const o = selectMonthlyOverview(receipts(100.1), payouts(0.2, 0))
    expect(o.expense).toBe(0.2)
    expect(o.net).toBe(99.9)
  })

  it('对账：经现有 selectFinanceReceipts/selectFinancePayouts 聚合后，净额 == Σ(from_client) − Σ(to_company) − Σ(to_referrer) == 改版前公式', () => {
    const cases = { c1: mkCase({}) }
    const customers = { cu1: mkCustomer({ referrer_id: 'r1' }) }
    const referrers = { r1: mkReferrer({}) }
    const pays = [
      mkPayment({ id: 'a', direction: 'from_client', amount: 6500, paid_at: '2026-05-03', fee_category: '律师费' }),
      mkPayment({ id: 'b', direction: 'from_client', amount: 2200.55, paid_at: '2026-05-08' }),
      mkPayment({ id: 'c', direction: 'to_company', amount: 3000, paid_at: '2026-05-05' }),
      mkPayment({ id: 'd', direction: 'to_company', amount: 1200.45, paid_at: '2026-05-10' }),
      mkPayment({ id: 'e', direction: 'to_referrer', amount: 800, paid_at: '2026-05-15' }),
    ]
    const r = selectFinanceReceipts(pays, cases, customers)
    const p = selectFinancePayouts(pays, cases, customers, referrers)
    const o = selectMonthlyOverview(r, p)
    // 与逐笔 Σ 一致
    expect(o.income).toBe(6500 + 2200.55)
    expect(o.toCompany).toBe(3000 + 1200.45)
    expect(o.toReferrer).toBe(800)
    expect(o.net).toBe(Math.round((6500 + 2200.55 - 3000 - 1200.45 - 800) * 100) / 100)
    // 与改版前 FinancePage 内联公式一致：receipts.total − round2(toCompanyTotal + toReferrerTotal)
    const oldExpense = Math.round((p.toCompanyTotal + p.toReferrerTotal) * 100) / 100
    const oldNet = Math.round((r.total - oldExpense) * 100) / 100
    expect(o.expense).toBe(oldExpense)
    expect(o.net).toBe(oldNet)
  })

  it('空月：全 0，无 delta 时为 null（UI 省略该行）', () => {
    const o = selectMonthlyOverview(receipts(0), payouts(0, 0))
    expect(o).toMatchObject({ income: 0, toCompany: 0, toReferrer: 0, expense: 0, net: 0, delta: null })
  })

  it('较上月：金额差 + 百分比（上月净额为基数，四舍五入整数百分比）', () => {
    const o = selectMonthlyOverview(receipts(22200), payouts(4200, 2300), receipts(17000), payouts(2000, 1000))
    // prevNet = 17000 − 3000 = 14000；delta = 15700 − 14000 = 1700；pct = round(1700/14000*100) = 12
    expect(o.delta).toEqual({ amount: 1700, pct: 12 })
  })

  it('较上月下跌：负 delta 与负 pct', () => {
    const o = selectMonthlyOverview(receipts(7000), payouts(0, 0), receipts(10000), payouts(0, 0))
    expect(o.delta).toEqual({ amount: -3000, pct: -30 })
  })

  it('上月净额为 0：pct 为 null（不显示百分比，不除零）', () => {
    const o = selectMonthlyOverview(receipts(5000), payouts(0, 0), receipts(0), payouts(0, 0))
    expect(o.delta).toEqual({ amount: 5000, pct: null })
  })
})

describe('groupPayouts', () => {
  it('按 direction 分成 付主代理 / 付介绍人 两组，保持原顺序', () => {
    const items = [
      mkPayout({ paymentId: 'x1', direction: 'to_company' }),
      mkPayout({ paymentId: 'x2', direction: 'to_referrer' }),
      mkPayout({ paymentId: 'x3', direction: 'to_company' }),
    ]
    const g = groupPayouts(items)
    expect(g.toCompany.map((i) => i.paymentId)).toEqual(['x1', 'x3'])
    expect(g.toReferrer.map((i) => i.paymentId)).toEqual(['x2'])
  })
})

describe('格式化', () => {
  it("monthTitle: '2026-05' → '2026年5月'（不补零）", () => {
    expect(monthTitle('2026-05')).toBe('2026年5月')
    expect(monthTitle('2026-11')).toBe('2026年11月')
  })
  it("formatMonthDay: '2026-05-03' → '5月3日'；null → '—'", () => {
    expect(formatMonthDay('2026-05-03')).toBe('5月3日')
    expect(formatMonthDay('2026-12-31')).toBe('12月31日')
    expect(formatMonthDay(null)).toBe('—')
  })
})

describe('行小字 / 显示名（全用真实字段，永不为空）', () => {
  it('收入行：fee_category · note；缺一显示另一个；全缺退付款方式', () => {
    expect(receiptSubtitle({ feeCategory: '律师费', note: '首期', method: 'transfer' })).toBe('律师费 · 首期')
    expect(receiptSubtitle({ feeCategory: '律师费', note: null, method: 'transfer' })).toBe('律师费')
    expect(receiptSubtitle({ feeCategory: null, note: null, method: 'cash' })).toBe('现金')
  })
  it('支出行：note 优先，退付款方式', () => {
    expect(payoutSubtitle({ note: '提名代理费', method: 'transfer' })).toBe('提名代理费')
    expect(payoutSubtitle({ note: null, method: 'transfer' })).toBe('转账')
  })
  it('支出行显示名：to_company=客户名；to_referrer=介绍人名，缺失退客户名', () => {
    expect(payoutDisplayName(mkPayout({ direction: 'to_company', customerName: '张三' }))).toBe('张三')
    expect(payoutDisplayName(mkPayout({ direction: 'to_referrer', referrerName: 'RV Design' }))).toBe('RV Design')
    expect(payoutDisplayName(mkPayout({ direction: 'to_referrer', referrerName: null, customerName: '张三' }))).toBe('张三')
  })
})
