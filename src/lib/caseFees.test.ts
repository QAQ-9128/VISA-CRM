import { describe, expect, it } from 'vitest'
import { selectCaseFeeGroups } from './caseFees'
import { getCaseTotals } from './planItems'
import type { Case, Customer, Payment, PaymentPlan, PaymentPlanItem } from '../types/models'

const mkCust = (o: Partial<Customer>): Customer => ({
  id: 'c1', full_name: '甲', birth_date: null, gender: null, passport_no: null, nationality: null,
  phone: null, email: null, wechat: null, address: null, sponsor_employer_id: null, sponsor_position: null,
  referrer_id: null, owner_referrer_id: null, primary_applicant_id: null, relationship_to_primary: null, client_source: null,
  is_starred: false, notes: null, assigned_to: null, created_by: null, is_archived: false,
  created_at: '', updated_at: '', ...o,
})
const mkCase = (o: Partial<Case>): Case => ({
  id: 'ca1', case_number: '12345678', customer_id: 'P', visa_subclass: '482', visa_stream: 'Core Skill', case_category: null, case_details: null,
  destination_country: null, sponsor_position: null, sponsor_employer_id: null, current_stage: 'nomination_lodged', currency: 'AUD', sync_tracking: true,
  trt_reminder_enabled: false, trt_reminder_dismissed: false, cohab_reminder_enabled: false, cohab_reminder_last: null, parent_case_id: null, parent_sync_progress: false, assigned_to: null,
  created_by: null, is_archived: false, created_at: '', updated_at: '', ...o,
})
const mkPlan = (o: Partial<PaymentPlan>): PaymentPlan => ({
  id: 'pl1', case_id: 'ca1', applicant_id: null, billed_to_customer_id: null, client_total: null,
  company_total: null, referrer_total: null, staged_billing: false, currency: 'AUD', note: null,
  created_at: '', updated_at: '', ...o,
})
const mkItem = (o: Partial<PaymentPlanItem>): PaymentPlanItem => ({
  id: 'it1', plan_id: 'pl1', fee_category: '律师费', amount_due: 1000, periods: 1, note: null,
  created_at: '', updated_at: '', ...o,
})
const mkPay = (o: Partial<Payment>): Payment => ({
  id: 'pay1', case_id: 'ca1', applicant_id: null, direction: 'from_client', installment_id: null,
  plan_item_id: null, amount: 0, currency: 'AUD', method: 'transfer', paid_at: null, note: null,
  fee_category: null, invoice_path: null, invoice_name: null, from_client_customer_id: null,
  recorded_by: null, created_at: '', ...o,
})
const custById = (list: Customer[]): Record<string, Customer> =>
  Object.fromEntries(list.map((c) => [c.id, c]))

describe('selectCaseFeeGroups — 客户应收视图（仅 from_client，无任何应付行；分开模式）', () => {
  const customers = [mkCust({ id: 'P', full_name: 'Alice' })]
  const caseRow = mkCase({ id: 'ca1', customer_id: 'P', sync_tracking: false })
  // 故意设了应付总额 + 应付付款：本卡必须全部不出现，且不影响客户侧口径
  const plan = mkPlan({ id: 'pl1', case_id: 'ca1', applicant_id: 'P', company_total: 1000, referrer_total: 500 })
  const items = [
    mkItem({ id: 'law', plan_id: 'pl1', fee_category: '律师费', amount_due: 1000, created_at: '2026-01-01' }),
    mkItem({ id: 'copy', plan_id: 'pl1', fee_category: '文案', amount_due: 2000, created_at: '2026-01-02' }),
  ]
  const payments = [
    mkPay({ id: 'r1', direction: 'from_client', plan_item_id: 'law', applicant_id: 'P', amount: 800 }),
    mkPay({ id: 'r2', direction: 'from_client', plan_item_id: 'copy', applicant_id: 'P', amount: 200 }),
    mkPay({ id: 'c1', direction: 'to_company', applicant_id: 'P', amount: 600 }),
    mkPay({ id: 'f1', direction: 'to_referrer', applicant_id: 'P', amount: 500 }),
  ]
  const out = selectCaseFeeGroups(caseRow, ['P'], [plan], payments, custById(customers), items)

  it('🔒 只含 from_client 款项行，无任何应付（主代理/介绍人）行', () => {
    const allLines = out.groups.flatMap((g) => g.lines)
    expect(allLines.every((l) => l.kind === 'receivable')).toBe(true)
    expect(allLines.map((l) => l.label)).toEqual(['律师费', '文案'])
    expect(allLines.some((l) => l.label.includes('主代理') || l.label.includes('介绍人'))).toBe(false)
  })
  it('款项状态按真实收款派生（待付款/已收款口径）', () => {
    const recv = out.groups[0].lines
    expect(recv[0]).toMatchObject({ amount: 1000, paid: 800, unpaid: 200, status: 'owing' })
    expect(recv[1]).toMatchObject({ amount: 2000, paid: 200, unpaid: 1800, status: 'owing' })
  })
  it('🔒 底部=客户侧合计（应收/已收/未收，与 getCaseTotals 同口径）；应付付款不影响已收', () => {
    const t = getCaseTotals(items, payments)
    expect(out.totals).toEqual({ receivable: t.totalDue, paid: t.totalPaid, unpaid: Math.max(0, t.totalUnpaid) })
    expect(out.totals).toEqual({ receivable: 3000, paid: 1000, unpaid: 2000 }) // to_company/to_referrer 不计入
  })
  it('单一组成员 → multi=false、一组；participants=组成员', () => {
    expect(out.multi).toBe(false)
    expect(out.groups).toHaveLength(1)
    expect(out.participants).toEqual([{ id: 'P', name: 'Alice' }])
  })
})

describe('selectCaseFeeGroups — 多人（按组成员分组，分开模式）', () => {
  const customers = [mkCust({ id: 'P', full_name: 'Alice' }), mkCust({ id: 'S', full_name: 'Ben' })]
  const caseRow = mkCase({ id: 'ca1', customer_id: 'P', sync_tracking: false })
  const planP = mkPlan({ id: 'plP', case_id: 'ca1', applicant_id: 'P' })
  const planS = mkPlan({ id: 'plS', case_id: 'ca1', applicant_id: 'S' })
  const items = [
    mkItem({ id: 'lawP', plan_id: 'plP', fee_category: '律师费', amount_due: 1000 }),
    mkItem({ id: 'lawS', plan_id: 'plS', fee_category: '律师费', amount_due: 1000 }),
  ]
  const payments = [
    mkPay({ id: 'rp', direction: 'from_client', plan_item_id: 'lawP', applicant_id: 'P', amount: 1000 }),
    mkPay({ id: 'rs', direction: 'from_client', plan_item_id: 'lawS', applicant_id: 'S', amount: 500 }),
  ]
  const out = selectCaseFeeGroups(caseRow, ['P', 'S'], [planP, planS], payments, custById(customers), items)

  it('每位组成员一组（案件客户在前）+ 按人小计；记账绑定各人 applicant_id', () => {
    expect(out.multi).toBe(true)
    expect(out.groups.map((g) => g.participantName)).toEqual(['Alice', 'Ben'])
    expect(out.groups.map((g) => g.applicantId)).toEqual(['P', 'S']) // 分开：写各人名下
    expect(out.groups[0]).toMatchObject({ receivable: 1000, paid: 1000, unpaid: 0 })
    expect(out.groups[1]).toMatchObject({ receivable: 1000, paid: 500, unpaid: 500 })
  })
  it('🔒 合计 = Σ各人（应收 2000 / 已收 1500 / 未收 500）', () => {
    expect(out.totals).toEqual({ receivable: 2000, paid: 1500, unpaid: 500 })
  })
})

describe('selectCaseFeeGroups — 合并模式归主申名下（组头=主申名）', () => {
  const customers = [mkCust({ id: 'P', full_name: 'Alice' })]
  const caseRow = mkCase({ id: 'ca1', customer_id: 'P' })
  const plan = mkPlan({ id: 'pl1', case_id: 'ca1', applicant_id: null }) // 合并模式
  const items = [mkItem({ id: 'law', plan_id: 'pl1', fee_category: '律师费', amount_due: 1000 })]
  const payments = [mkPay({ id: 'r1', direction: 'from_client', plan_item_id: 'law', applicant_id: null, amount: 700 })]
  const out = selectCaseFeeGroups(caseRow, ['P'], [plan], payments, custById(customers), items)

  it('合并(sync_tracking=true)：组头=主申名、款项归他名下，无「合并/未分人」；记账写案件级合并账(applicant_id=null)', () => {
    expect(out.groups).toHaveLength(1)
    expect(out.groups.map((g) => g.participantName)).toEqual(['Alice'])
    expect(out.groups[0].applicantId).toBeNull() // 合并：与财务页 merged 行同口径
    expect(out.groups[0].lines.map((l) => l.label)).toEqual(['律师费'])
    expect(out.groups[0]).toMatchObject({ receivable: 1000, paid: 700, unpaid: 300 })
  })
  it('🔒 合计含合并数据（不丢款项）', () => {
    expect(out.totals).toEqual({ receivable: 1000, paid: 700, unpaid: 300 })
  })
})

describe('selectCaseFeeGroups — 分组覆盖全部参与人（没记款的也显示，bug 修复）', () => {
  // 3 位参与人（贾乃亮=案件客户、李小璐、PGONE），只有贾乃亮名下有款（合并口径 applicant_id=null）
  const customers = [
    mkCust({ id: 'P', full_name: '贾乃亮' }),
    mkCust({ id: 'L', full_name: '李小璐' }),
    mkCust({ id: 'G', full_name: 'PGONE' }),
  ]
  const memberIds = ['P', 'L', 'G']
  const plan = mkPlan({ id: 'pl1', case_id: 'ca1', applicant_id: null })
  const items = [mkItem({ id: 'law', plan_id: 'pl1', fee_category: '律师费', amount_due: 1 })]
  const payments: Payment[] = []

  it('合并模式：3 个参与人都出分组（与顶部「本案参与人」同源）；没款的人空分组、小计 0', () => {
    const caseRow = mkCase({ id: 'ca1', customer_id: 'P', sync_tracking: true })
    const out = selectCaseFeeGroups(caseRow, memberIds, [plan], payments, custById(customers), items)
    expect(out.groups.map((g) => g.participantName)).toEqual(['贾乃亮', '李小璐', 'PGONE']) // 案件客户在前，其余按名
    // 贾乃亮（owner）拿到合并款项；其余两位空分组、小计 0
    expect(out.groups[0].lines.map((l) => l.label)).toEqual(['律师费'])
    expect(out.groups[0]).toMatchObject({ receivable: 1, paid: 0, unpaid: 1 })
    expect(out.groups[1]).toMatchObject({ lines: [], receivable: 0, paid: 0, unpaid: 0 })
    expect(out.groups[2]).toMatchObject({ lines: [], receivable: 0, paid: 0, unpaid: 0 })
    // 记账口径不变：合并模式 owner 加款仍写 applicant_id=null；其他成员写各自 id
    expect(out.groups[0].applicantId).toBeNull()
    expect(out.groups[1].applicantId).toBe('L')
    expect(out.groups[2].applicantId).toBe('G')
  })

  it('🔒 本案合计改前=改后：应收 1 / 已收 0 / 未收 1（空分组小计 0 不影响）', () => {
    const caseRow = mkCase({ id: 'ca1', customer_id: 'P', sync_tracking: true })
    const out = selectCaseFeeGroups(caseRow, memberIds, [plan], payments, custById(customers), items)
    expect(out.totals).toEqual({ receivable: 1, paid: 0, unpaid: 1 })
  })

  it('🔒 选/不选参与人只影响"按人分组展示"：合计与 getCaseTotals 口径一致、与参与人选择无关（改前=改后）', () => {
    const caseRow = mkCase({ id: 'ca1', customer_id: 'P', sync_tracking: false })
    const pay = [mkPay({ id: 'r1', direction: 'from_client', plan_item_id: 'law', applicant_id: null, amount: 0.4 })]
    const onlyOwner = selectCaseFeeGroups(caseRow, ['P'], [plan], pay, custById(customers), items)
    const allThree = selectCaseFeeGroups(caseRow, memberIds, [plan], pay, custById(customers), items)
    const t = getCaseTotals(items, pay)
    const expected = { receivable: t.totalDue, paid: t.totalPaid, unpaid: Math.max(0, t.totalUnpaid) }
    expect(onlyOwner.totals).toEqual(expected)
    expect(allThree.totals).toEqual(expected) // 多选两位没记款的参与人 → 净额/合计一分不变
  })

  it('分开模式同样全员出分组（既有行为，回归保护）', () => {
    const caseRow = mkCase({ id: 'ca1', customer_id: 'P', sync_tracking: false })
    const out = selectCaseFeeGroups(caseRow, memberIds, [], [], custById(customers), [])
    expect(out.groups.map((g) => g.participantName)).toEqual(['贾乃亮', '李小璐', 'PGONE'])
    expect(out.totals).toEqual({ receivable: 0, paid: 0, unpaid: 0 })
  })
})

describe('selectCaseFeeGroups — 不丢款项：非组成员 applicant_id 也成单元', () => {
  it('遗留 applicant_id 指向组外客户 → 其款项仍计入合计（分开模式）', () => {
    const customers = [mkCust({ id: 'P', full_name: 'Alice' }), mkCust({ id: 'X', full_name: 'Xtra' })]
    const caseRow = mkCase({ id: 'ca1', customer_id: 'P', sync_tracking: false })
    const planX = mkPlan({ id: 'plX', case_id: 'ca1', applicant_id: 'X' })
    const items = [mkItem({ id: 'itX', plan_id: 'plX', fee_category: '评估费', amount_due: 700 })]
    const payments = [mkPay({ id: 'rx', direction: 'from_client', plan_item_id: 'itX', applicant_id: 'X', amount: 700 })]
    const out = selectCaseFeeGroups(caseRow, ['P'], [planX], payments, custById(customers), items)
    expect(out.groups.some((g) => g.participantId === 'X')).toBe(true)
    expect(out.totals).toEqual({ receivable: 700, paid: 700, unpaid: 0 })
    // 但「添加款项」下拉只列组成员
    expect(out.participants).toEqual([{ id: 'P', name: 'Alice' }])
  })
})

describe('selectCaseFeeGroups — 空态', () => {
  it('无计划无付款 → 仅组成员空行组、合计为 0', () => {
    const out = selectCaseFeeGroups(
      mkCase({ id: 'ca1', customer_id: 'P' }),
      ['P'],
      [],
      [],
      custById([mkCust({ id: 'P', full_name: 'Alice' })]),
      [],
    )
    expect(out.totals).toEqual({ receivable: 0, paid: 0, unpaid: 0 })
    expect(out.multi).toBe(false)
    expect(out.groups[0].lines).toEqual([])
  })
})
