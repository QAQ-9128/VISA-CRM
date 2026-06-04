import { describe, expect, it } from 'vitest'
import {
  computeDebtTotals,
  selectCustomerDebts,
  selectCustomerDebtSummary,
  selectCustomersWithOpenTasks,
  selectOverdueInstallments,
  selectTodoCases,
  sortPriorityCustomers,
  countActiveCases,
  caseStageDistribution,
  sumClientReceiptsInMonth,
  monthOverMonth,
  monthlyClientReceipts,
  selectExpiringDocs,
  selectLodgementProgressRows,
} from './dashboard'
import type {
  Case,
  CaseDocument,
  CaseStageHistory,
  Customer,
  Installment,
  Lodgement,
  Payment,
  PaymentPlan,
  PaymentPlanItem,
  RecordRow,
} from '../types/models'

const TODAY = new Date(2026, 0, 15)

// 测试用的最小工厂
const mkCase = (o: Partial<Case>): Case => ({ id: 'c1', case_number: '00000001', customer_id: 'cu1', visa_subclass: '482', visa_stream: null, current_stage: 'visa_lodged', currency: 'AUD', sync_tracking: true, trt_reminder_enabled: false, parent_case_id: null, parent_sync_progress: false, destination_country: 'Australia', sponsor_position: null, sponsor_employer_id: null, assigned_to: null, created_by: null, is_archived: false, created_at: '', updated_at: '', ...o })
const mkCustomer = (o: Partial<Customer>): Customer => ({ id: 'cu1', full_name: '张三', is_starred: false, client_source: null, primary_applicant_id: null, relationship_to_primary: null, birth_date: null, gender: null, passport_no: null, nationality: null, phone: null, email: null, wechat: null, address: null, sponsor_employer_id: null, sponsor_position: null, referrer_id: null, notes: null, assigned_to: null, created_by: null, is_archived: false, created_at: '', updated_at: '', ...o })

describe('selectTodoCases（待办案件：current_stage=todo、未归档，按 created_at 倒序）', () => {
  const customers = { cu1: mkCustomer({ id: 'cu1', full_name: '孙佳琪' }), cu2: mkCustomer({ id: 'cu2', full_name: '李娜' }) }

  it('单条待办案件 → 客户名 · 签证类型', () => {
    const cases = [mkCase({ id: 'c1', customer_id: 'cu1', current_stage: 'todo', visa_subclass: '482', visa_stream: 'Core Skills' })]
    const r = selectTodoCases(cases, customers)
    expect(r).toHaveLength(1)
    expect(r[0]).toEqual({ caseId: 'c1', customerId: 'cu1', customerName: '孙佳琪', visaLabel: '482/Core Skills' })
  })
  it('多条待办按 created_at 倒序（最新在上）', () => {
    const cases = [
      mkCase({ id: 'old', customer_id: 'cu1', current_stage: 'todo', created_at: '2026-01-01T00:00:00Z' }),
      mkCase({ id: 'new', customer_id: 'cu1', current_stage: 'todo', created_at: '2026-03-01T00:00:00Z' }),
    ]
    expect(selectTodoCases(cases, customers).map((t) => t.caseId)).toEqual(['new', 'old'])
  })
  it('只取 todo：非待办阶段不列入', () => {
    const cases = [
      mkCase({ id: 'a', current_stage: 'todo' }),
      mkCase({ id: 'b', current_stage: 'visa_lodged' }),
      mkCase({ id: 'c', current_stage: 'granted' }),
    ]
    expect(selectTodoCases(cases, customers).map((t) => t.caseId)).toEqual(['a'])
  })
  it('排除已归档案件', () => {
    const cases = [
      mkCase({ id: 'a', current_stage: 'todo', is_archived: false }),
      mkCase({ id: 'b', current_stage: 'todo', is_archived: true }),
    ]
    expect(selectTodoCases(cases, customers).map((t) => t.caseId)).toEqual(['a'])
  })
  it('无待办案件 → 空数组', () => {
    expect(selectTodoCases([mkCase({ current_stage: 'drafted' })], customers)).toEqual([])
  })
  it('多客户多案件：各占一行，不合并', () => {
    const cases = [
      mkCase({ id: 'c1', customer_id: 'cu1', current_stage: 'todo', created_at: '2026-01-03T00:00:00Z' }),
      mkCase({ id: 'c2', customer_id: 'cu2', current_stage: 'todo', created_at: '2026-01-02T00:00:00Z' }),
      mkCase({ id: 'c3', customer_id: 'cu1', current_stage: 'todo', created_at: '2026-01-01T00:00:00Z' }),
    ]
    const r = selectTodoCases(cases, customers)
    expect(r.map((t) => t.caseId)).toEqual(['c1', 'c2', 'c3']) // 同客户 cu1 两条各占一行
    expect(r.map((t) => t.customerName)).toEqual(['孙佳琪', '李娜', '孙佳琪'])
  })
})

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
  it('只取星标客户，按姓名排序（不再依赖等级/来源）', () => {
    const list = [
      mkCustomer({ id: 'z', full_name: 'Z', is_starred: true, client_source: 'green' }),
      mkCustomer({ id: 'a', full_name: 'A', is_starred: true, client_source: null }),
      mkCustomer({ id: 'm', full_name: 'M', is_starred: true, client_source: 'red' }),
      mkCustomer({ id: 'unstar', full_name: 'AAA', is_starred: false }),
    ]
    const r = sortPriorityCustomers(list)
    // 未星标的 AAA 被排除；其余按姓名 A→M→Z（来源不影响排序）
    expect(r.map((c) => c.id)).toEqual(['a', 'm', 'z'])
  })
})

describe('computeDebtTotals', () => {
  it('合计客户欠款与欠主代理（按案件分组，负数不计）', () => {
    const plans: PaymentPlan[] = [
      { id: 'p1', case_id: 'c1', applicant_id: null, billed_to_customer_id: null, client_total: 1000, company_total: 800, referrer_total: null, staged_billing: false, currency: 'AUD', note: null, created_at: '', updated_at: '' },
      { id: 'p2', case_id: 'c2', applicant_id: null, billed_to_customer_id: null, client_total: 500, company_total: 0, referrer_total: null, staged_billing: false, currency: 'AUD', note: null, created_at: '', updated_at: '' },
    ]
    const items = [
      { id: 'i1', plan_id: 'p1', amount_due: 1000 },
      { id: 'i2', plan_id: 'p2', amount_due: 500 },
    ] as PaymentPlanItem[]
    const payments = [
      { case_id: 'c1', direction: 'from_client', amount: 300, plan_item_id: 'i1' },
      { case_id: 'c1', direction: 'to_company', amount: 800 },
      { case_id: 'c2', direction: 'from_client', amount: 500, plan_item_id: 'i2' },
    ] as Payment[]
    const r = computeDebtTotals(plans, payments, items)
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
      id, case_id: caseId, applicant_id: null, billed_to_customer_id: null, client_total: ct, company_total: mt, referrer_total: null, staged_billing: false, currency: 'AUD', note: null, created_at: '', updated_at: '',
    })
    const plans = [
      plan('p1', 'c1', 1000, 800),
      plan('p2', 'c2', 500, 0),
      plan('p3', 'c3', 2000, 1000),
      plan('p4', 'c4', 100, 0), // 丙 已结清
    ]
    const items = [
      { id: 'i1', plan_id: 'p1', amount_due: 1000 },
      { id: 'i2', plan_id: 'p2', amount_due: 500 },
      { id: 'i3', plan_id: 'p3', amount_due: 2000 },
      { id: 'i4', plan_id: 'p4', amount_due: 100 },
    ] as PaymentPlanItem[]
    const payments = [
      { case_id: 'c1', direction: 'from_client', amount: 300, plan_item_id: 'i1' },
      { case_id: 'c1', direction: 'to_company', amount: 800 },
      { case_id: 'c2', direction: 'from_client', amount: 500, plan_item_id: 'i2' },
      { case_id: 'c4', direction: 'from_client', amount: 100, plan_item_id: 'i4' },
    ] as Payment[]

    const r = selectCustomerDebts(plans, payments, cases, customers, items)
    expect(r.map((x) => x.customerId)).toEqual(['cuB', 'cuA']) // 丙 已结清被剔除
    expect(r[0]).toMatchObject({ customerName: '乙', clientOwes: 2000, companyOwes: 1000, color: 'blue' })
    expect(r[1]).toMatchObject({ customerName: '甲', clientOwes: 700, companyOwes: 0, color: 'blue' }) // c1 700 + c2 0
  })
})

describe('selectCustomerDebts — 按 billed_to 实际付款方聚合', () => {
  const mkPlan = (o: Partial<PaymentPlan>): PaymentPlan => ({
    id: 'p1', case_id: 'c1', applicant_id: null, billed_to_customer_id: null, client_total: 0, company_total: 0, referrer_total: null, staged_billing: false,
    currency: 'AUD', note: null, created_at: '', updated_at: '', ...o,
  })
  const cases = { c1: mkCase({ id: 'c1', customer_id: 'primary' }) }
  const customers = {
    primary: mkCustomer({ id: 'primary', full_name: '主申请' }),
    sub: mkCustomer({ id: 'sub', full_name: '副申请', primary_applicant_id: 'primary' }),
    stranger: mkCustomer({ id: 'stranger', full_name: '无关人' }),
  }
  const items = [{ id: 'i1', plan_id: 'p1', amount_due: 1000 }] as PaymentPlanItem[]

  it('billed_to 未设(null) → 欠款挂主申请名下（向后兼容；含删除后 set null 回落）', () => {
    const plans = [mkPlan({ id: 'p1', case_id: 'c1', billed_to_customer_id: null })]
    const r = selectCustomerDebts(plans, [], cases, customers, items)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ customerId: 'primary', clientOwes: 1000 })
  })

  it('billed_to = 副申请 → 欠款挂副申请名下，不挂主申请', () => {
    const plans = [mkPlan({ id: 'p1', case_id: 'c1', billed_to_customer_id: 'sub' })]
    const r = selectCustomerDebts(plans, [], cases, customers, items)
    expect(r.map((x) => x.customerId)).toEqual(['sub'])
    expect(r[0]).toMatchObject({ customerId: 'sub', customerName: '副申请', clientOwes: 1000 })
  })

  it('billed_to = 完全无关客户 → 挂该客户名下', () => {
    const plans = [mkPlan({ id: 'p1', case_id: 'c1', billed_to_customer_id: 'stranger' })]
    const r = selectCustomerDebts(plans, [], cases, customers, items)
    expect(r[0]).toMatchObject({ customerId: 'stranger', customerName: '无关人', clientOwes: 1000 })
  })

  it('billed_to 未设、但计划属于某副申请(applicant_id) → 挂该副申请名下（与财务页一致，不算到主申请头上）', () => {
    const plans = [mkPlan({ id: 'p1', case_id: 'c1', applicant_id: 'sub', billed_to_customer_id: null })]
    const r = selectCustomerDebts(plans, [], cases, customers, items)
    expect(r.map((x) => x.customerId)).toEqual(['sub'])
    expect(r[0]).toMatchObject({ customerId: 'sub', customerName: '副申请', clientOwes: 1000 })
  })

  it('归属优先级：billed_to > applicant_id > 案件主申请', () => {
    const plans = [mkPlan({ id: 'p1', case_id: 'c1', applicant_id: 'sub', billed_to_customer_id: 'stranger' })]
    const r = selectCustomerDebts(plans, [], cases, customers, items)
    expect(r[0]).toMatchObject({ customerId: 'stranger' }) // billed_to 优先于 applicant_id
  })

  it('一个客户被多个 case 的 billed_to 指向 → 正确求和', () => {
    const cases2 = { c1: mkCase({ id: 'c1', customer_id: 'primary' }), c2: mkCase({ id: 'c2', customer_id: 'other' }) }
    const plans = [
      mkPlan({ id: 'p1', case_id: 'c1', billed_to_customer_id: 'stranger' }),
      mkPlan({ id: 'p2', case_id: 'c2', billed_to_customer_id: 'stranger' }),
    ]
    const items2 = [
      { id: 'i1', plan_id: 'p1', amount_due: 1000 },
      { id: 'i2', plan_id: 'p2', amount_due: 500 },
    ] as PaymentPlanItem[]
    const r = selectCustomerDebts(plans, [], cases2, customers, items2)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ customerId: 'stranger', clientOwes: 1500 })
  })
})

describe('selectCustomerDebtSummary — 客户详情归集欠款（含他不是主申请但被 billed_to 指向的案件）', () => {
  const mkPlan = (o: Partial<PaymentPlan>): PaymentPlan => ({
    id: 'p1', case_id: 'c1', applicant_id: null, billed_to_customer_id: null, client_total: 0, company_total: 0, referrer_total: null, staged_billing: false,
    currency: 'AUD', note: null, created_at: '', updated_at: '', ...o,
  })
  // c1 主申=me（自己的案件）；c2 主申=别人，但 billed_to=me
  const cases = { c1: mkCase({ id: 'c1', customer_id: 'me' }), c2: mkCase({ id: 'c2', customer_id: 'other' }) }
  const plans = [
    mkPlan({ id: 'p1', case_id: 'c1', billed_to_customer_id: null }), // 自己案件，挂自己
    mkPlan({ id: 'p2', case_id: 'c2', billed_to_customer_id: 'me' }), // 别人案件，账单挂自己
  ]
  const items = [
    { id: 'i1', plan_id: 'p1', amount_due: 1000 },
    { id: 'i2', plan_id: 'p2', amount_due: 500 },
  ] as PaymentPlanItem[]

  it('汇总所有归集到该客户名下的欠款（自己案件 + 被指向的案件）', () => {
    const s = selectCustomerDebtSummary('me', plans, [], cases, items)
    expect(s.clientOwes).toBe(1500)
    expect(s.color).toBe('blue')
  })

  it('无归集欠款 → 0、color=default', () => {
    const s = selectCustomerDebtSummary('nobody', plans, [], cases, items)
    expect(s.clientOwes).toBe(0)
    expect(s.color).toBe('default')
  })
})

describe('countActiveCases（进行中案件：未归档且非终态 granted/refused/withdrawn）', () => {
  it('排除已归档与终态阶段', () => {
    const cases = [
      mkCase({ id: 'a', current_stage: 'visa_lodged' }),
      mkCase({ id: 'b', current_stage: 'nomination_lodged' }),
      mkCase({ id: 'c', current_stage: 'granted' }), // 终态
      mkCase({ id: 'd', current_stage: 'refused' }), // 终态
      mkCase({ id: 'e', current_stage: 'withdrawn' }), // 终态
      mkCase({ id: 'f', current_stage: 'todo', is_archived: true }), // 归档
    ]
    expect(countActiveCases(cases)).toBe(2)
  })
  it('空 → 0', () => {
    expect(countActiveCases([])).toBe(0)
  })
})

describe('caseStageDistribution（按 current_stage 统计未归档案件，按流程顺序，仅 count>0）', () => {
  it('计数并按 CASE_STAGES 顺序排列、含标签与配色、跳过归档与零项', () => {
    const cases = [
      mkCase({ id: '1', current_stage: 'todo' }),
      mkCase({ id: '2', current_stage: 'visa_lodged' }),
      mkCase({ id: '3', current_stage: 'visa_lodged' }),
      mkCase({ id: '4', current_stage: 'todo' }),
      mkCase({ id: '5', current_stage: 'granted' }),
      mkCase({ id: '6', current_stage: 'visa_lodged', is_archived: true }), // 归档不计
    ]
    const r = caseStageDistribution(cases)
    expect(r.map((x) => [x.stage, x.count])).toEqual([
      ['todo', 2],
      ['visa_lodged', 2],
      ['granted', 1],
    ])
    expect(r[0]).toMatchObject({ label: '待办' })
    expect(r[0].color).toMatch(/^#/) // 有十六进制配色
  })
  it('空 → 空数组', () => {
    expect(caseStageDistribution([])).toEqual([])
  })
})

describe('sumClientReceiptsInMonth（某月 from_client 收款合计）', () => {
  const mk = (o: Partial<Payment>): Payment => ({
    id: 'p', case_id: 'c1', applicant_id: null, direction: 'from_client', installment_id: null, plan_item_id: null,
    from_client_customer_id: null, amount: 0, currency: 'AUD', method: 'transfer', paid_at: null, note: null,
    fee_category: null, invoice_path: null, invoice_name: null, recorded_by: null, created_at: '', ...o,
  })
  it('只算指定月份的客户付款；忽略其它方向/其它月份/无日期；金额字符串可强转', () => {
    const payments = [
      mk({ direction: 'from_client', amount: 1000, paid_at: '2026-01-10' }),
      mk({ direction: 'from_client', amount: '200' as unknown as number, paid_at: '2026-01-31' }),
      mk({ direction: 'to_company', amount: 9999, paid_at: '2026-01-15' }), // 非客户付款
      mk({ direction: 'from_client', amount: 500, paid_at: '2025-12-31' }), // 上月
      mk({ direction: 'from_client', amount: 7, paid_at: null }), // 无日期
    ]
    expect(sumClientReceiptsInMonth(payments, 2026, 0)).toBe(1200)
  })
  it('该月无收款 → 0', () => {
    expect(sumClientReceiptsInMonth([], 2026, 0)).toBe(0)
  })
})

describe('monthOverMonth（月环比：方向 + 百分比，保留一位小数）', () => {
  it('上升', () => {
    expect(monthOverMonth(120, 100)).toEqual({ pct: 20, dir: 'up' })
  })
  it('下降', () => {
    expect(monthOverMonth(80, 100)).toEqual({ pct: 20, dir: 'down' })
  })
  it('持平', () => {
    expect(monthOverMonth(100, 100)).toEqual({ pct: 0, dir: 'flat' })
  })
  it('上月为 0、本月有值 → 无百分比、方向 up', () => {
    expect(monthOverMonth(50, 0)).toEqual({ pct: null, dir: 'up' })
  })
  it('上月为 0、本月也 0 → 无百分比、方向 flat', () => {
    expect(monthOverMonth(0, 0)).toEqual({ pct: null, dir: 'flat' })
  })
})

describe('monthlyClientReceipts（近 N 月 from_client 收款序列）', () => {
  const mk = (paid_at: string | null, amount: number, direction: Payment['direction'] = 'from_client'): Payment => ({
    id: 'p', case_id: 'c1', applicant_id: null, direction, installment_id: null, plan_item_id: null,
    from_client_customer_id: null, amount, currency: 'AUD', method: 'transfer', paid_at, note: null,
    fee_category: null, invoice_path: null, invoice_name: null, recorded_by: null, created_at: '',
  })
  it('返回 6 个月、末月为当月且标 hi、按月汇总客户付款', () => {
    const payments = [
      mk('2026-01-10', 1000),
      mk('2025-12-20', 500),
      mk('2026-01-15', 9999, 'to_company'), // 非客户付款不计
    ]
    const r = monthlyClientReceipts(payments, 2026, 0, 6) // 截至 2026-01
    expect(r).toHaveLength(6)
    expect(r.map((x) => x.label)).toEqual(['8月', '9月', '10月', '11月', '12月', '1月'])
    expect(r[5]).toEqual({ label: '1月', value: 1000, hi: true })
    expect(r[4]).toMatchObject({ label: '12月', value: 500, hi: false })
    expect(r[0]).toMatchObject({ value: 0 })
  })
})

describe('selectExpiringDocs（文档到期：仅 ≤30 天或已过期，按紧急度排序）', () => {
  const mk = (o: Partial<CaseDocument>): CaseDocument => ({
    id: 'd', customer_id: 'cu1', case_id: null, doc_type: 'passport', title: null, storage_path: null,
    file_name: null, issue_date: null, expiry_date: null, note: null, uploaded_by: null, is_archived: false,
    created_at: '', updated_at: '', ...o,
  })
  const customers = { cu1: mkCustomer({ id: 'cu1', full_name: '陈静' }), cu2: mkCustomer({ id: 'cu2', full_name: '王强' }) }
  it('过滤、排序、配色、图标、客户名兜底', () => {
    const docs = [
      mk({ id: 'med', customer_id: 'cu1', doc_type: 'medical', expiry_date: '2026-01-21' }), // 6 天
      mk({ id: 'pp', customer_id: 'cu2', doc_type: 'passport', expiry_date: '2026-02-02' }), // 18 天
      mk({ id: 'far', customer_id: 'cu1', doc_type: 'passport', expiry_date: '2026-06-01' }), // 远 → 排除
      mk({ id: 'over', customer_id: 'cu2', doc_type: 'police_check', expiry_date: '2026-01-10' }), // 逾期 5 天
      mk({ id: 'none', customer_id: 'cu1', expiry_date: null }), // 无到期 → 排除
      mk({ id: 'gone', customer_id: 'zzz', doc_type: 'medical', expiry_date: '2026-01-20' }), // 客户不在册 → 排除
    ]
    const r = selectExpiringDocs(docs, customers, TODAY) // TODAY=2026-01-15
    expect(r.map((x) => x.id)).toEqual(['over', 'med', 'pp']) // 按 daysRemaining 升序：-5, 6, 18
    expect(r[0]).toMatchObject({ customerName: '王强', label: '无犯罪', tone: 'rose' }) // 逾期 → rose
    expect(r[1]).toMatchObject({ customerName: '陈静', label: '体检', tone: 'rose', ic: 'clock' }) // ≤7 天 → rose, 体检→clock
    expect(r[2]).toMatchObject({ tone: 'amber', ic: 'passport' }) // 18 天 → amber
  })
})

describe('selectLodgementProgressRows（递交进度行：派生递交日期/状态 + 进度）', () => {
  const mkLg = (o: Partial<Lodgement>): Lodgement => ({
    id: 'l', case_id: 'c1', type: 'nomination', lodged_date: null, reference_number: null,
    dha_processing_days: 120, dha_processing_updated_at: null, outcome: 'pending', outcome_date: null,
    note: null, created_by: null, created_at: '', updated_at: '', ...o,
  })
  const mkH = (o: Partial<CaseStageHistory>): CaseStageHistory => ({
    id: 'h', case_id: 'c1', from_stage: null, to_stage: 'nomination_lodged', note: null, changed_by: null,
    changed_at: '2025-12-01T00:00:00Z', effective_at: '2025-12-01T00:00:00Z', ...o,
  })
  const cases = {
    c1: mkCase({ id: 'c1', customer_id: 'cu1', visa_subclass: '482', current_stage: 'nomination_lodged' }),
    c2: mkCase({ id: 'c2', customer_id: 'cu2', visa_subclass: '186', current_stage: 'granted' }),
  }
  const customers = { cu1: mkCustomer({ id: 'cu1', full_name: '张伟' }), cu2: mkCustomer({ id: 'cu2', full_name: '王强' }) }

  it('未递交（无对应阶段历史）→ 跳过；已递交 → 计算进度与状态', () => {
    const lodgements = [
      mkLg({ id: 'l1', case_id: 'c1', type: 'nomination', dha_processing_days: 120 }),
      mkLg({ id: 'l2', case_id: 'c2', type: 'visa', dha_processing_days: 150 }),
      mkLg({ id: 'l3', case_id: 'c1', type: 'visa', dha_processing_days: 150 }), // c1 未到签证递交 → 无 lodged date → 跳过
    ]
    const history = [
      mkH({ case_id: 'c1', to_stage: 'nomination_lodged', effective_at: '2025-12-01T00:00:00Z' }),
      mkH({ case_id: 'c2', to_stage: 'visa_lodged', effective_at: '2025-10-01T00:00:00Z' }),
    ]
    const r = selectLodgementProgressRows(lodgements, history, cases, customers, TODAY)
    expect(r.map((x) => x.id)).toEqual(['l1', 'l2']) // l3 无递交日期被跳过；按递交日期倒序 l1(12月)→l2(10月)
    expect(r[0]).toMatchObject({ name: '张伟', visa: '482 提名', date: '2025-12-01', statusLabel: '处理中', statusTone: 'blue' })
    expect(r[1]).toMatchObject({ name: '王强', visa: '186 签证', statusLabel: '已批', statusTone: 'emerald', remainingText: '已完成' })
    expect(r[0].barColor).toBe('#3b6bff')
  })

  it('已超期且未批 → 状态「已超期」rose、剩余文案「超 N 天」', () => {
    const lodgements = [mkLg({ id: 'lx', case_id: 'c1', type: 'nomination', dha_processing_days: 30 })]
    const history = [mkH({ case_id: 'c1', to_stage: 'nomination_lodged', effective_at: '2025-11-01T00:00:00Z' })]
    const r = selectLodgementProgressRows(lodgements, history, cases, customers, TODAY)
    expect(r[0]).toMatchObject({ statusLabel: '已超期', statusTone: 'rose' })
    expect(r[0].barColor).toBe('#f43f5e')
    expect(r[0].remainingText).toMatch(/^超 \d+ 天$/)
  })
})
