import { describe, expect, it } from 'vitest'
import {
  computeDebtTotals,
  selectCustomerDebts,
  selectCustomersWithOpenTasks,
  selectOverdueInstallments,
  sortPriorityCustomers,
} from './dashboard'
import type { Case, Customer, Installment, Payment, PaymentPlan, RecordRow } from '../types/models'

const TODAY = new Date(2026, 0, 15)

// 测试用的最小工厂
const mkCase = (o: Partial<Case>): Case => ({ id: 'c1', case_number: '00000001', customer_id: 'cu1', visa_subclass: '482', visa_stream: null, current_stage: 'visa_lodged', currency: 'AUD', sync_tracking: true, destination_country: 'Australia', assigned_to: null, created_by: null, is_archived: false, created_at: '', updated_at: '', ...o })
const mkCustomer = (o: Partial<Customer>): Customer => ({ id: 'cu1', full_name: '张三', is_starred: false, priority_tier: null, primary_applicant_id: null, relationship_to_primary: null, birth_date: null, gender: null, passport_no: null, nationality: null, phone: null, email: null, wechat: null, address: null, sponsor_employer_id: null, referrer_id: null, notes: null, assigned_to: null, created_by: null, is_archived: false, created_at: '', updated_at: '', ...o })

describe('selectCustomersWithOpenTasks', () => {
  const mkTask = (o: Partial<RecordRow>): RecordRow => ({ id: 't', customer_id: 'cu1', case_id: null, type: 'task', content: '待办', due_date: null, is_done: false, done_at: null, assigned_to: null, channel: null, emoji_marker: null, created_by: null, created_at: '', updated_at: '', ...o })
  it('按客户去重计数未完成待办；无客户/不在册客户不计；按数量降序', () => {
    const customers = { cu1: mkCustomer({ id: 'cu1', full_name: '甲' }), cu2: mkCustomer({ id: 'cu2', full_name: '乙' }) }
    const tasks = [
      mkTask({ id: 't1', customer_id: 'cu1' }),
      mkTask({ id: 't2', customer_id: 'cu1' }),
      mkTask({ id: 't3', customer_id: 'cu2' }),
      mkTask({ id: 't4', customer_id: null as unknown as string }), // 无客户 → 不计
      mkTask({ id: 't5', customer_id: 'gone' }), // 不在 active map → 不计
    ]
    const r = selectCustomersWithOpenTasks(tasks, customers)
    expect(r.map((x) => x.customerId)).toEqual(['cu1', 'cu2'])
    expect(r[0]).toMatchObject({ customerName: '甲', openCount: 2 })
    expect(r[1]).toMatchObject({ customerName: '乙', openCount: 1 })
  })
})

describe('selectOverdueInstallments', () => {
  it('未付且 due < 今天', () => {
    const plans = { p1: { id: 'p1', case_id: 'c1' } as PaymentPlan }
    const cases = { c1: mkCase({ id: 'c1', customer_id: 'cu1' }) }
    const customers = { cu1: mkCustomer({ id: 'cu1', full_name: '王五' }) }
    const mk = (o: Partial<Installment>): Installment => ({ id: 'i', payment_plan_id: 'p1', label: null, due_date: null, amount: 100, is_paid: false, paid_at: null, created_at: '', updated_at: '', ...o })
    const items = [
      mk({ id: 'overdue', due_date: '2026-01-01' }), // -14 ✓
      mk({ id: 'paid', due_date: '2026-01-01', is_paid: true }), // ✗
      mk({ id: 'future', due_date: '2026-02-01' }), // ✗
    ]
    const r = selectOverdueInstallments(items, plans, cases, customers, TODAY)
    expect(r.map((x) => x.installmentId)).toEqual(['overdue'])
    expect(r[0].daysOverdue).toBe(14)
    expect(r[0].caseId).toBe('c1')
    expect(r[0].customerName).toBe('王五')
  })
})

describe('sortPriorityCustomers', () => {
  it('星标客户按等级 vip→a→b→c→未分级 排序', () => {
    const list = [
      mkCustomer({ id: 'b', full_name: 'B', is_starred: true, priority_tier: 'b' }),
      mkCustomer({ id: 'none', full_name: 'N', is_starred: true, priority_tier: null }),
      mkCustomer({ id: 'vip', full_name: 'V', is_starred: true, priority_tier: 'vip' }),
      mkCustomer({ id: 'a', full_name: 'A', is_starred: true, priority_tier: 'a' }),
      mkCustomer({ id: 'unstar', full_name: 'U', is_starred: false }),
    ]
    const r = sortPriorityCustomers(list)
    expect(r.map((c) => c.id)).toEqual(['vip', 'a', 'b', 'none'])
  })
})

describe('computeDebtTotals', () => {
  it('合计客户欠款与欠主代理（按案件分组，负数不计）', () => {
    const plans: PaymentPlan[] = [
      { id: 'p1', case_id: 'c1', applicant_id: null, client_total: 1000, company_total: 800, currency: 'AUD', note: null, created_at: '', updated_at: '' },
      { id: 'p2', case_id: 'c2', applicant_id: null, client_total: 500, company_total: 0, currency: 'AUD', note: null, created_at: '', updated_at: '' },
    ]
    const payments = [
      { case_id: 'c1', direction: 'from_client', amount: 300 },
      { case_id: 'c1', direction: 'to_company', amount: 800 },
      { case_id: 'c2', direction: 'from_client', amount: 500 },
    ] as Payment[]
    const r = computeDebtTotals(plans, payments)
    expect(r.clientOwesTotal).toBe(700) // c1: 1000-300=700, c2: 0
    expect(r.companyOwesTotal).toBe(0) // c1: 800-800=0
  })
})

describe('selectCustomerDebts', () => {
  it('按客户跨案件合计欠款，剔除已结清，按客户欠款降序', () => {
    const cases = {
      c1: mkCase({ id: 'c1', customer_id: 'cuA' }),
      c2: mkCase({ id: 'c2', customer_id: 'cuA' }),
      c3: mkCase({ id: 'c3', customer_id: 'cuB' }),
      c4: mkCase({ id: 'c4', customer_id: 'cuC' }),
    }
    const customers = {
      cuA: mkCustomer({ id: 'cuA', full_name: '甲' }),
      cuB: mkCustomer({ id: 'cuB', full_name: '乙' }),
      cuC: mkCustomer({ id: 'cuC', full_name: '丙' }),
    }
    const plan = (id: string, caseId: string, ct: number, mt: number): PaymentPlan => ({
      id, case_id: caseId, applicant_id: null, client_total: ct, company_total: mt, currency: 'AUD', note: null, created_at: '', updated_at: '',
    })
    const plans = [
      plan('p1', 'c1', 1000, 800),
      plan('p2', 'c2', 500, 0),
      plan('p3', 'c3', 2000, 1000),
      plan('p4', 'c4', 100, 0), // 丙 已结清
    ]
    const payments = [
      { case_id: 'c1', direction: 'from_client', amount: 300 },
      { case_id: 'c1', direction: 'to_company', amount: 800 },
      { case_id: 'c2', direction: 'from_client', amount: 500 },
      { case_id: 'c4', direction: 'from_client', amount: 100 },
    ] as Payment[]

    const r = selectCustomerDebts(plans, payments, cases, customers)
    expect(r.map((x) => x.customerId)).toEqual(['cuB', 'cuA']) // 丙 已结清被剔除
    expect(r[0]).toMatchObject({ customerName: '乙', clientOwes: 2000, companyOwes: 1000 })
    expect(r[1]).toMatchObject({ customerName: '甲', clientOwes: 700, companyOwes: 0 }) // c1 700 + c2 0
  })
})
