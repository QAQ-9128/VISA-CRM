import { describe, expect, it } from 'vitest'
import {
  selectFinanceReceivables,
  sumFinanceReceivables,
  selectFinanceReceipts,
  selectFinancePayouts,
  selectCustomerFinance,
} from './finance'
import type { Case, Customer, Payment, PaymentPlan, Referrer } from '../types/models'

// 最小工厂
const mkCase = (o: Partial<Case>): Case => ({
  id: 'c1', case_number: '00000001', customer_id: 'cu1', visa_subclass: '482', visa_stream: null, current_stage: 'visa_lodged',
  currency: 'AUD', sync_tracking: true, destination_country: 'Australia', assigned_to: null, created_by: null,
  is_archived: false, created_at: '', updated_at: '', ...o,
})
const mkCustomer = (o: Partial<Customer>): Customer => ({
  id: 'cu1', full_name: '张三', is_starred: false, priority_tier: null, primary_applicant_id: null,
  relationship_to_primary: null, birth_date: null, gender: null, passport_no: null, nationality: null, phone: null,
  email: null, wechat: null, address: null, sponsor_employer_id: null, referrer_id: null, notes: null,
  assigned_to: null, created_by: null, is_archived: false, created_at: '', updated_at: '', ...o,
})
const mkPlan = (o: Partial<PaymentPlan>): PaymentPlan => ({
  id: 'p1', case_id: 'c1', applicant_id: null, client_total: 0, company_total: 0, currency: 'AUD', note: null,
  created_at: '', updated_at: '', ...o,
})
const mkPayment = (o: Partial<Payment>): Payment => ({
  id: 'pay1', case_id: 'c1', applicant_id: null, direction: 'from_client', installment_id: null, amount: 0,
  currency: 'AUD', method: 'transfer', paid_at: null, note: null, invoice_path: null, invoice_name: null,
  recorded_by: null, created_at: '', ...o,
})
const mkReferrer = (o: Partial<Referrer>): Referrer => ({
  id: 'r1', name: '王介绍', contact_phone: null, contact_email: null, notes: null,
  is_archived: false, created_by: null, created_at: '', updated_at: '', ...o,
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
      mkPayment({ id: 'p1', case_id: 'c1', direction: 'from_client', amount: 300, method: 'cash', paid_at: '2026-05-02', note: '定金', invoice_path: 'cu1/c1/inv.pdf', invoice_name: 'inv.pdf' }),
      mkPayment({ id: 'p2', case_id: 'c1', direction: 'from_client', amount: 200, paid_at: '2026-05-01' }),
      mkPayment({ id: 'p3', case_id: 'c1', direction: 'to_company', amount: 999 }), // 忽略
      mkPayment({ id: 'p4', case_id: 'c1', direction: 'from_client', amount: -50 }), // 负数不计入合计
    ]
    const r = selectFinanceReceipts(payments, caseById, customerById)
    expect(r.items.map((i) => i.paymentId)).toEqual(['p1', 'p2', 'p4']) // 按日期倒序（无日期最后）
    expect(r.items.find((i) => i.paymentId === 'p1')).toMatchObject({
      amount: 300, method: 'cash', customerName: '张三', visaSubclass: '482', caseNumber: '12345678',
      customerId: 'cu1', note: '定金', caseId: 'c1', invoicePath: 'cu1/c1/inv.pdf', invoiceName: 'inv.pdf',
    })
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
})
