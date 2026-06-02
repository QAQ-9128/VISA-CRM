import { describe, expect, it } from 'vitest'
import {
  installmentSummaryByPlan,
  receivableRowStatus,
  owingCustomerCount,
  buildFinanceTableRows,
  filterFinanceTableRows,
  financeRowsToCsv,
  EMPTY_INSTALLMENT_SUMMARY,
} from './financeRows'
import type { Installment } from '../types/models'
import type { ReceivableRow } from './finance'

const TODAY = new Date('2026-06-15T00:00:00Z')

const inst = (over: Partial<Installment> & Pick<Installment, 'id' | 'payment_plan_id'>): Installment =>
  ({ label: null, due_date: null, amount: 0, is_paid: false, paid_at: null, created_at: '', ...over }) as Installment

const recRow = (over: Partial<ReceivableRow> & Pick<ReceivableRow, 'caseId'>): ReceivableRow =>
  ({
    applicantId: null,
    role: 'merged',
    coApplicantNames: [],
    planId: null,
    customerId: 'cu1',
    customerName: '张三',
    visaSubclass: '482',
    receivable: 0,
    paid: 0,
    unpaid: 0,
    staged: false,
    stages: [],
    ...over,
  }) as ReceivableRow

describe('installmentSummaryByPlan', () => {
  it('按计划归集总期/已付期/下一期/逾期', () => {
    const m = installmentSummaryByPlan(
      [
        inst({ id: 'a', payment_plan_id: 'p1', is_paid: true, due_date: '2026-03-01' }),
        inst({ id: 'b', payment_plan_id: 'p1', is_paid: false, due_date: '2026-05-20', label: '律师费第 2 期' }), // 逾期
        inst({ id: 'c', payment_plan_id: 'p1', is_paid: false, due_date: '2026-08-01' }),
      ],
      TODAY,
    )
    const s = m.get('p1')!
    expect(s.total).toBe(3)
    expect(s.paid).toBe(1)
    expect(s.hasOverdue).toBe(true)
    expect(s.next).toMatchObject({ label: '律师费第 2 期', dueDate: '2026-05-20' })
    expect(s.next!.overdueDays).toBeGreaterThan(0) // 5-20 已过
  })

  it('全部已付 → next 为 null、无逾期', () => {
    const m = installmentSummaryByPlan([inst({ id: 'a', payment_plan_id: 'p1', is_paid: true })], TODAY)
    expect(m.get('p1')).toMatchObject({ total: 1, paid: 1, next: null, hasOverdue: false })
  })
})

describe('receivableRowStatus', () => {
  it('未设应收 / 已结清 / 逾期 / 待收', () => {
    expect(receivableRowStatus({ receivable: 0, unpaid: 0 }).kind).toBe('unset')
    expect(receivableRowStatus({ receivable: 1000, unpaid: 0 }).kind).toBe('settled')
    expect(receivableRowStatus({ receivable: 1000, unpaid: 500 }, { ...EMPTY_INSTALLMENT_SUMMARY, hasOverdue: true }).kind).toBe('overdue')
    expect(receivableRowStatus({ receivable: 1000, unpaid: 500 }).kind).toBe('pending')
  })
})

describe('owingCustomerCount', () => {
  it('去重统计有未付的客户', () => {
    expect(
      owingCustomerCount([
        { customerId: 'a', unpaid: 100 },
        { customerId: 'a', unpaid: 50 },
        { customerId: 'b', unpaid: 0 },
        { customerId: 'c', unpaid: 200 },
      ]),
    ).toBe(2) // a, c
  })
})

describe('buildFinanceTableRows + filter', () => {
  const rows = [
    recRow({ caseId: 'c1', customerName: '张伟', visaSubclass: '482', planId: 'p1', receivable: 1000, paid: 400, unpaid: 600 }),
    recRow({ caseId: 'c2', customerName: '王芳', visaSubclass: '500', planId: null, receivable: 0, paid: 0, unpaid: 0 }),
  ]
  const instByPlan = installmentSummaryByPlan([inst({ id: 'a', payment_plan_id: 'p1', is_paid: true })], TODAY)
  const built = buildFinanceTableRows(rows, instByPlan, { c1: 'AA1', c2: 'BB2' })

  it('补案件号 / 分期 / 状态 / 百分比', () => {
    expect(built[0]).toMatchObject({ caseNumber: 'AA1', percent: 40 })
    expect(built[0].inst.total).toBe(1)
    expect(built[0].status.kind).toBe('pending')
    expect(built[1].status.kind).toBe('unset')
  })

  it('搜索（客户/案件号）+ 状态过滤', () => {
    expect(filterFinanceTableRows(built, { search: '王芳', status: '' }).map((e) => e.row.caseId)).toEqual(['c2'])
    expect(filterFinanceTableRows(built, { search: 'aa1', status: '' }).map((e) => e.row.caseId)).toEqual(['c1'])
    expect(filterFinanceTableRows(built, { search: '', status: 'unset' }).map((e) => e.row.caseId)).toEqual(['c2'])
  })

  it('导出 CSV 含表头与数据', () => {
    const csv = financeRowsToCsv(built)
    expect(csv.split('\n')[0]).toContain('客户')
    expect(csv).toContain('张伟')
    expect(csv).toContain('1/1') // 分期 paid/total
  })
})
