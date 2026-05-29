import { describe, expect, it } from 'vitest'
import {
  selectFinanceReceivables,
  sumFinanceReceivables,
  selectFinanceReceipts,
  selectFinancePayouts,
  selectCustomerFinance,
  filterPaymentsByMonth,
  selectRecentCases,
  getCustomerPaymentColor,
  selectCasePaymentColors,
} from './finance'
import type { ReceivableRow } from './finance'
import type { Case, Customer, Payment, PaymentPlan, Referrer } from '../types/models'

// 最小工厂
const mkCase = (o: Partial<Case>): Case => ({
  id: 'c1', case_number: '00000001', customer_id: 'cu1', visa_subclass: '482', visa_stream: null, current_stage: 'visa_lodged',
  currency: 'AUD', sync_tracking: true, destination_country: 'Australia', assigned_to: null, created_by: null,
  is_archived: false, created_at: '', updated_at: '', ...o,
})
const mkCustomer = (o: Partial<Customer>): Customer => ({
  id: 'cu1', full_name: '张三', is_starred: false, client_source: null, primary_applicant_id: null,
  relationship_to_primary: null, birth_date: null, gender: null, passport_no: null, nationality: null, phone: null,
  email: null, wechat: null, address: null, sponsor_employer_id: null, sponsor_position: null, referrer_id: null, notes: null,
  assigned_to: null, created_by: null, is_archived: false, created_at: '', updated_at: '', ...o,
})
const mkPlan = (o: Partial<PaymentPlan>): PaymentPlan => ({
  id: 'p1', case_id: 'c1', applicant_id: null, client_total: 0, company_total: 0, currency: 'AUD', note: null,
  created_at: '', updated_at: '', ...o,
})
const mkPayment = (o: Partial<Payment>): Payment => ({
  id: 'pay1', case_id: 'c1', applicant_id: null, direction: 'from_client', installment_id: null, amount: 0,
  currency: 'AUD', method: 'transfer', paid_at: null, note: null, fee_category: null, invoice_path: null, invoice_name: null,
  recorded_by: null, created_at: '', ...o,
})
const mkReferrer = (o: Partial<Referrer>): Referrer => ({
  id: 'r1', name: '王介绍', contact_phone: null, contact_email: null, notes: null,
  is_archived: false, created_by: null, created_at: '', updated_at: '', ...o,
})

describe('filterPaymentsByMonth', () => {
  const pays = [
    mkPayment({ id: 'a', paid_at: '2026-04-30' }), // 上月最后一天
    mkPayment({ id: 'b', paid_at: '2026-05-01' }), // 当月第一天
    mkPayment({ id: 'c', paid_at: '2026-05-31' }), // 当月最后一天
    mkPayment({ id: 'd', paid_at: '2026-06-01' }), // 下月第一天
    mkPayment({ id: 'e', paid_at: null }), // 无日期
  ]

  it('当月：含 5/1 与 5/31，排除相邻月与无日期（跨月边界）', () => {
    expect(filterPaymentsByMonth(pays, '2026-05').map((p) => p.id)).toEqual(['b', 'c'])
  })
  it('null（全部）：原样返回，含无日期', () => {
    expect(filterPaymentsByMonth(pays, null).map((p) => p.id)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
  it('未来月份：无匹配 → 空', () => {
    expect(filterPaymentsByMonth(pays, '2027-01')).toEqual([])
  })
  it('空数据 → 空', () => {
    expect(filterPaymentsByMonth([], '2026-05')).toEqual([])
    expect(filterPaymentsByMonth([], null)).toEqual([])
  })
})

describe('selectRecentCases', () => {
  it('按 updated_at 倒序取前 N（同时间按 id 稳定）', () => {
    const cs = [
      mkCase({ id: 'a', updated_at: '2026-05-01T00:00:00Z' }),
      mkCase({ id: 'b', updated_at: '2026-05-20T00:00:00Z' }),
      mkCase({ id: 'c', updated_at: '2026-05-10T00:00:00Z' }),
    ]
    expect(selectRecentCases(cs, 2).map((c) => c.id)).toEqual(['b', 'c'])
  })
  it('不足 N 返回全部；不改原数组', () => {
    const cs = [mkCase({ id: 'x' })]
    expect(selectRecentCases(cs, 5)).toHaveLength(1)
    expect(cs).toHaveLength(1)
  })
  it('空 → 空', () => {
    expect(selectRecentCases([], 5)).toEqual([])
  })
})

describe('selectFinanceReceivables', () => {
  it('按案件一行：应收/已付/未付；to_company/to_referrer 不计入已付', () => {
    const cases = [
      mkCase({ id: 'c1', customer_id: 'cu1', visa_subclass: '482' }),
      mkCase({ id: 'c2', customer_id: 'cu1', visa_subclass: '186' }),
    ]
    const customerById = { cu1: mkCustomer({ id: 'cu1', full_name: '张三' }) }
    const plans = [
      mkPlan({ id: 'p1', case_id: 'c1', client_total: 1000 }),
      mkPlan({ id: 'p2', case_id: 'c2', client_total: 500 }),
    ]
    const payments = [
      mkPayment({ id: 'a', case_id: 'c1', direction: 'from_client', amount: 300 }),
      mkPayment({ id: 'b', case_id: 'c2', direction: 'from_client', amount: 500 }),
      // 这两笔不计入「已付（应收）」
      mkPayment({ id: 'c', case_id: 'c1', direction: 'to_company', amount: 200 }),
      mkPayment({ id: 'd', case_id: 'c1', direction: 'to_referrer', amount: 100 }),
    ]
    const rows = selectFinanceReceivables(cases, [], plans, payments, customerById)
    expect(rows).toHaveLength(2)
    const c1 = rows.find((r) => r.caseId === 'c1')!
    expect(c1).toMatchObject({
      caseId: 'c1', applicantId: null, planId: 'p1', customerId: 'cu1', customerName: '张三',
      visaSubclass: '482', receivable: 1000, paid: 300, unpaid: 700,
    })
    const c2 = rows.find((r) => r.caseId === 'c2')!
    expect(c2).toMatchObject({ caseId: 'c2', receivable: 500, paid: 500, unpaid: 0 })
    // 排序：未付多的在前
    expect(rows[0].caseId).toBe('c1')
  })

  it('不同步案件：主申+每个副申各一行，按 applicant_id 分别归集已付', () => {
    const cases = [mkCase({ id: 'c1', customer_id: 'cu1', visa_subclass: '482', sync_tracking: false })]
    const caseApplicants = [{ id: 'a1', case_id: 'c1', customer_id: 'cu2', created_at: '' }]
    const customerById = {
      cu1: mkCustomer({ id: 'cu1', full_name: '李旻书' }),
      cu2: mkCustomer({ id: 'cu2', full_name: '邓韬', primary_applicant_id: 'cu1' }),
    }
    const plans = [
      mkPlan({ id: 'p1', case_id: 'c1', applicant_id: 'cu1', client_total: 1000 }),
      mkPlan({ id: 'p2', case_id: 'c1', applicant_id: 'cu2', client_total: 600 }),
    ]
    const payments = [
      mkPayment({ id: 'a', case_id: 'c1', applicant_id: 'cu1', direction: 'from_client', amount: 400 }),
      mkPayment({ id: 'b', case_id: 'c1', applicant_id: 'cu2', direction: 'from_client', amount: 600 }),
    ]
    const rows = selectFinanceReceivables(cases, caseApplicants, plans, payments, customerById)
    expect(rows).toHaveLength(2)
    // 同案件主/副相邻，主申在前
    expect(rows[0].role).toBe('primary')
    expect(rows[1].role).toBe('secondary')
    const main = rows.find((r) => r.applicantId === 'cu1')!
    expect(main).toMatchObject({ planId: 'p1', customerId: 'cu1', customerName: '李旻书', role: 'primary', receivable: 1000, paid: 400, unpaid: 600 })
    const sub = rows.find((r) => r.applicantId === 'cu2')!
    expect(sub).toMatchObject({ planId: 'p2', customerId: 'cu2', customerName: '邓韬', role: 'secondary', receivable: 600, paid: 600, unpaid: 0 })
  })

  it('同步案件：一行合并，role=merged 且列出同案副申名字', () => {
    const cases = [mkCase({ id: 'c1', customer_id: 'cu1', sync_tracking: true })]
    const caseApplicants = [{ id: 'a1', case_id: 'c1', customer_id: 'cu2', created_at: '' }]
    const customerById = {
      cu1: mkCustomer({ id: 'cu1', full_name: '李旻书' }),
      cu2: mkCustomer({ id: 'cu2', full_name: '邓韬', primary_applicant_id: 'cu1' }),
    }
    const plans = [mkPlan({ id: 'p1', case_id: 'c1', applicant_id: null, client_total: 1500 })]
    const payments = [
      mkPayment({ id: 'a', case_id: 'c1', applicant_id: null, direction: 'from_client', amount: 400 }),
      mkPayment({ id: 'b', case_id: 'c1', applicant_id: 'cu2', direction: 'from_client', amount: 600 }),
    ]
    const rows = selectFinanceReceivables(cases, caseApplicants, plans, payments, customerById)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      applicantId: null, role: 'merged', customerName: '李旻书',
      coApplicantNames: ['邓韬'], receivable: 1500, paid: 1000, unpaid: 500,
    })
  })

  it('案件无 plan 时应收=0、planId=null，仍出现（可在页面上设应收）', () => {
    const cases = [mkCase({ id: 'c1', customer_id: 'cu1' })]
    const customerById = { cu1: mkCustomer({ id: 'cu1' }) }
    const rows = selectFinanceReceivables(cases, [], [], [], customerById)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ caseId: 'c1', planId: null, receivable: 0, paid: 0, unpaid: 0 })
  })

  it('多收（已付 > 应收）时未付计 0，不出现负数', () => {
    const cases = [mkCase({ id: 'c1', customer_id: 'cu1' })]
    const customerById = { cu1: mkCustomer({ id: 'cu1' }) }
    const plans = [mkPlan({ case_id: 'c1', client_total: 100 })]
    const payments = [mkPayment({ case_id: 'c1', direction: 'from_client', amount: 150 })]
    const rows = selectFinanceReceivables(cases, [], plans, payments, customerById)
    expect(rows[0].unpaid).toBe(0)
    expect(rows[0].paid).toBe(150)
  })
})

describe('sumFinanceReceivables', () => {
  it('各列合计', () => {
    const totals = sumFinanceReceivables([
      { caseId: 'c1', applicantId: null, role: 'merged', coApplicantNames: [], planId: 'p1', customerId: 'a', customerName: 'A', visaSubclass: '482', receivable: 1000, paid: 300, unpaid: 700 },
      { caseId: 'c2', applicantId: null, role: 'merged', coApplicantNames: [], planId: null, customerId: 'b', customerName: 'B', visaSubclass: '186', receivable: 500, paid: 500, unpaid: 0 },
    ])
    expect(totals).toEqual({ receivable: 1500, paid: 800, unpaid: 700 })
  })
})

describe('selectFinanceReceipts', () => {
  it('只列 from_client，带客户·案件，合计；负数不计', () => {
    const caseById = { c1: mkCase({ id: 'c1', case_number: '12345678', customer_id: 'cu1', visa_subclass: '482' }) }
    const customerById = { cu1: mkCustomer({ id: 'cu1', full_name: '张三' }) }
    const payments = [
      mkPayment({ id: 'p1', case_id: 'c1', direction: 'from_client', amount: 300, method: 'cash', paid_at: '2026-05-02', note: '定金', fee_category: '律师费', invoice_path: 'cu1/c1/inv.pdf', invoice_name: 'inv.pdf' }),
      mkPayment({ id: 'p2', case_id: 'c1', direction: 'from_client', amount: 200, paid_at: '2026-05-01' }),
      mkPayment({ id: 'p3', case_id: 'c1', direction: 'to_company', amount: 999 }), // 忽略
      mkPayment({ id: 'p4', case_id: 'c1', direction: 'from_client', amount: -50 }), // 负数不计入合计
    ]
    const r = selectFinanceReceipts(payments, caseById, customerById)
    expect(r.items.map((i) => i.paymentId)).toEqual(['p1', 'p2', 'p4']) // 按日期倒序（无日期最后）
    expect(r.items.find((i) => i.paymentId === 'p1')).toMatchObject({
      amount: 300, method: 'cash', customerName: '张三', visaSubclass: '482', caseNumber: '12345678',
      customerId: 'cu1', note: '定金', feeCategory: '律师费', caseId: 'c1', invoicePath: 'cu1/c1/inv.pdf', invoiceName: 'inv.pdf',
    })
    // 未填类别的记录 feeCategory 为 null
    expect(r.items.find((i) => i.paymentId === 'p2')?.feeCategory).toBeNull()
    expect(r.total).toBe(500)
  })
})

describe('selectFinancePayouts', () => {
  it('只列 to_company / to_referrer，带客户名与介绍人名，各自合计', () => {
    const caseById = { c1: mkCase({ id: 'c1', customer_id: 'cu1' }) }
    const customerById = { cu1: mkCustomer({ id: 'cu1', full_name: '张三', referrer_id: 'r1' }) }
    const referrerById = { r1: mkReferrer({ id: 'r1', name: '王介绍' }) }
    const payments = [
      mkPayment({ id: 'p1', case_id: 'c1', direction: 'from_client', amount: 1000 }), // 忽略
      mkPayment({ id: 'p2', case_id: 'c1', direction: 'to_company', amount: 600, method: 'transfer', paid_at: '2026-05-01' }),
      mkPayment({ id: 'p3', case_id: 'c1', direction: 'to_referrer', amount: 150, method: 'cash', paid_at: '2026-05-02' }),
    ]
    const r = selectFinancePayouts(payments, caseById, customerById, referrerById)
    expect(r.items.map((i) => i.paymentId)).toEqual(['p3', 'p2']) // 按日期倒序
    const company = r.items.find((i) => i.paymentId === 'p2')!
    expect(company).toMatchObject({ direction: 'to_company', amount: 600, method: 'transfer', customerName: '张三', referrerName: null })
    const referral = r.items.find((i) => i.paymentId === 'p3')!
    expect(referral).toMatchObject({ direction: 'to_referrer', amount: 150, customerName: '张三', referrerName: '王介绍' })
    expect(r.toCompanyTotal).toBe(600)
    expect(r.toReferrerTotal).toBe(150)
  })

  it('负数金额不计入合计', () => {
    const caseById = { c1: mkCase({ id: 'c1', customer_id: 'cu1' }) }
    const customerById = { cu1: mkCustomer({ id: 'cu1' }) }
    const payments = [
      mkPayment({ id: 'p1', case_id: 'c1', direction: 'to_company', amount: -50 }),
      mkPayment({ id: 'p2', case_id: 'c1', direction: 'to_company', amount: 200 }),
    ]
    const r = selectFinancePayouts(payments, caseById, customerById, {})
    expect(r.toCompanyTotal).toBe(200)
  })
})

describe('selectCustomerFinance', () => {
  it('只聚合该客户名下案件的应收/收款/支出，不串入别的客户', () => {
    const cases = [
      mkCase({ id: 'c1', customer_id: 'cu1', visa_subclass: '482' }),
      mkCase({ id: 'c2', customer_id: 'cu2', visa_subclass: '186' }), // 别的客户
    ]
    const customerById = {
      cu1: mkCustomer({ id: 'cu1', full_name: '张三', referrer_id: 'r1' }),
      cu2: mkCustomer({ id: 'cu2', full_name: '李四' }),
    }
    const referrerById = { r1: mkReferrer({ id: 'r1', name: '王介绍' }) }
    const plans = [
      mkPlan({ id: 'p1', case_id: 'c1', client_total: 1000 }),
      mkPlan({ id: 'p2', case_id: 'c2', client_total: 500 }),
    ]
    const payments = [
      mkPayment({ id: 'a', case_id: 'c1', direction: 'from_client', amount: 400 }),
      mkPayment({ id: 'b', case_id: 'c1', direction: 'to_referrer', amount: 100 }),
      mkPayment({ id: 'x', case_id: 'c2', direction: 'from_client', amount: 500 }), // 别的客户
    ]
    const r = selectCustomerFinance('cu1', cases, [], plans, payments, customerById, referrerById)
    expect(r.receivables).toHaveLength(1)
    expect(r.receivables[0]).toMatchObject({ caseId: 'c1', receivable: 1000, paid: 400, unpaid: 600 })
    expect(r.receivableTotals).toEqual({ receivable: 1000, paid: 400, unpaid: 600 })
    expect(r.receipts.items.map((i) => i.paymentId)).toEqual(['a'])
    expect(r.receipts.total).toBe(400)
    expect(r.payouts.items.map((i) => i.paymentId)).toEqual(['b'])
    expect(r.payouts.items[0]).toMatchObject({ direction: 'to_referrer', referrerName: '王介绍' })
    expect(r.payouts.toReferrerTotal).toBe(100)
  })

  it('财务合并 + 有副申：合并行带出副申名字（customerById 须含副申）', () => {
    const cases = [mkCase({ id: 'c1', customer_id: 'cu1', sync_tracking: true })]
    const customerById = {
      cu1: mkCustomer({ id: 'cu1', full_name: '张三' }),
      cu2: mkCustomer({ id: 'cu2', full_name: '李四', primary_applicant_id: 'cu1' }),
    }
    const caseApplicants = [{ id: 'x', case_id: 'c1', customer_id: 'cu2', created_at: '' }]
    const r = selectCustomerFinance('cu1', cases, caseApplicants, [], [], customerById, {})
    expect(r.receivables).toHaveLength(1)
    expect(r.receivables[0]).toMatchObject({ role: 'merged', customerName: '张三', coApplicantNames: ['李四'] })
  })
})

describe('getCustomerPaymentColor', () => {
  it('全部付清（未付=0 且 应收>0）→ green', () => {
    expect(getCustomerPaymentColor(1000, 1000, 0)).toBe('green')
  })
  it('部分付清（还欠钱）→ blue', () => {
    expect(getCustomerPaymentColor(1000, 400, 600)).toBe('blue')
  })
  it('全没付（应收>0、未付=应收）→ blue', () => {
    expect(getCustomerPaymentColor(1000, 0, 1000)).toBe('blue')
  })
  it('没立案 / 没收费（应收=0）→ default', () => {
    expect(getCustomerPaymentColor(0, 0, 0)).toBe('default')
  })
  it('超付（未付=0 且 应收>0）仍按付清 → green', () => {
    expect(getCustomerPaymentColor(1000, 1200, 0)).toBe('green')
  })
})

describe('selectCasePaymentColors', () => {
  const mkRow = (o: Partial<ReceivableRow>): ReceivableRow => ({
    caseId: 'c1', applicantId: null, role: 'merged', coApplicantNames: [], planId: 'p1',
    customerId: 'cu1', customerName: '张三', visaSubclass: '482', receivable: 0, paid: 0, unpaid: 0, ...o,
  })
  it('按案件聚合应收行 → 客户付款颜色（同案多行合计）', () => {
    const rows = [
      mkRow({ caseId: 'paid', receivable: 1000, paid: 1000, unpaid: 0 }),
      mkRow({ caseId: 'owe', receivable: 1000, paid: 200, unpaid: 800 }),
      mkRow({ caseId: 'none', receivable: 0, paid: 0, unpaid: 0 }),
      // 同案主+副两行：一行付清、一行欠 → 合计仍欠 → blue
      mkRow({ caseId: 'split', receivable: 500, paid: 500, unpaid: 0 }),
      mkRow({ caseId: 'split', receivable: 500, paid: 0, unpaid: 500 }),
    ]
    const m = selectCasePaymentColors(rows)
    expect(m).toEqual({ paid: 'green', owe: 'blue', none: 'default', split: 'blue' })
  })
})
