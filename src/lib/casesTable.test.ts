import { describe, expect, it } from 'vitest'
import {
  elapsedMonthsDays,
  formatElapsed,
  joinFamilyNames,
  selectCaseRows,
  sortCaseRows,
} from './casesTable'
import type { Case, CaseApplicant, Customer, Lodgement } from '../types/models'

const TODAY = new Date(2026, 4, 29) // 2026-05-29

const mkCase = (o: Partial<Case>): Case => ({
  id: 'c1', case_number: '00000001', customer_id: 'cu1', visa_subclass: '482', visa_stream: null, current_stage: 'visa_lodged',
  currency: 'AUD', sync_tracking: true, destination_country: 'Australia', assigned_to: null, created_by: null,
  is_archived: false, created_at: '', updated_at: '2026-05-20T00:00:00Z', ...o,
})
const mkCustomer = (o: Partial<Customer>): Customer => ({
  id: 'cu1', full_name: '李旻书', is_starred: false, priority_tier: null, primary_applicant_id: null,
  relationship_to_primary: null, birth_date: null, gender: null, passport_no: null, nationality: null, phone: null,
  email: null, wechat: null, address: null, sponsor_employer_id: null, referrer_id: null, notes: null,
  assigned_to: null, created_by: null, is_archived: false, created_at: '', updated_at: '', ...o,
})
const mkLodgement = (o: Partial<Lodgement>): Lodgement => ({
  id: 'l1', case_id: 'c1', type: 'nomination', lodged_date: null, reference_number: null,
  dha_processing_days: null, dha_processing_updated_at: null, outcome: 'pending', outcome_date: null,
  note: null, created_by: null, created_at: '', updated_at: '', ...o,
})
const ca = (case_id: string, customer_id: string): CaseApplicant => ({
  id: `${case_id}-${customer_id}`, case_id, customer_id, created_at: '',
})

describe('elapsedMonthsDays / formatElapsed', () => {
  it('整月+天 / 借月 / 仅天 / 未来0', () => {
    expect(elapsedMonthsDays('2025-01-15', new Date(2025, 3, 20))).toEqual({ months: 3, days: 5 })
    expect(elapsedMonthsDays('2025-01-31', new Date(2025, 2, 1))).toEqual({ months: 1, days: 1 })
    expect(elapsedMonthsDays('2026-05-20', new Date(2026, 4, 29))).toEqual({ months: 0, days: 9 })
    expect(elapsedMonthsDays('2026-06-01', new Date(2026, 4, 29))).toEqual({ months: 0, days: 0 })
    expect(formatElapsed('2025-01-15', new Date(2025, 3, 20))).toBe('3 个月 5 天')
    expect(formatElapsed('2026-05-20', new Date(2026, 4, 29))).toBe('9 天')
    expect(formatElapsed(null)).toBe('—')
  })
})

describe('joinFamilyNames', () => {
  it('案件客户在前，& 连接', () => {
    const primary = mkCustomer({ id: 'cu1', full_name: '李旻书' })
    const sub = mkCustomer({ id: 'cu2', full_name: '邓韬', primary_applicant_id: 'cu1' })
    expect(joinFamilyNames(primary, [primary, sub])).toBe('李旻书 & 邓韬')
    expect(joinFamilyNames(sub, [primary, sub])).toBe('邓韬 & 李旻书')
  })
})

describe('selectCaseRows', () => {
  const customers = [
    mkCustomer({ id: 'cu1', full_name: '李旻书' }),
    mkCustomer({ id: 'cu2', full_name: '邓韬', primary_applicant_id: 'cu1' }),
  ]

  it('同步案件一行：主申+副申分列，提名/签证日期，距今取较晚一次递交', () => {
    const cases = [mkCase({ id: 'c1', case_number: '12345678', customer_id: 'cu1', visa_subclass: '482', sync_tracking: true })]
    const lodgements = [
      mkLodgement({ case_id: 'c1', type: 'nomination', lodged_date: '2026-01-01' }),
      mkLodgement({ case_id: 'c1', type: 'visa', lodged_date: '2026-03-01' }),
    ]
    const rows = selectCaseRows(cases, lodgements, [ca('c1', 'cu2')], customers, TODAY)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      caseId: 'c1',
      caseNumber: '12345678',
      role: 'merged',
      primaryName: '李旻书',
      secondaryName: '邓韬',
      visaLabel: '482',
      nomLodgedDate: '2026-01-01',
      visaLodgedDate: '2026-03-01',
      updatedAt: '2026-05-20T00:00:00Z',
      currentStage: 'visa_lodged',
    })
    expect(rows[0].elapsed).toEqual(elapsedMonthsDays('2026-03-01', TODAY)) // 取较晚
  })

  it('提名/签证各自的距今(elapsed/daysSince)分开计算；缺哪边哪边为 null', () => {
    const cases = [mkCase({ id: 'c1', customer_id: 'cu1', sync_tracking: true })]
    const lodgements = [
      mkLodgement({ case_id: 'c1', type: 'nomination', lodged_date: '2026-01-01' }),
      mkLodgement({ case_id: 'c1', type: 'visa', lodged_date: '2026-03-01' }),
    ]
    const rows = selectCaseRows(cases, lodgements, [], [mkCustomer({ id: 'cu1', full_name: '李旻书' })], TODAY)
    expect(rows[0].nomElapsed).toEqual(elapsedMonthsDays('2026-01-01', TODAY))
    expect(rows[0].visaElapsed).toEqual(elapsedMonthsDays('2026-03-01', TODAY))
    expect(rows[0].nomDaysSince).toBe(148) // 2026-01-01 → 2026-05-29
    expect(rows[0].visaDaysSince).toBe(89) // 2026-03-01 → 2026-05-29

    // 只有签证递交 → 提名距今为 null
    const visaOnly = selectCaseRows(
      [mkCase({ id: 'c2', customer_id: 'cu1', sync_tracking: true })],
      [mkLodgement({ case_id: 'c2', type: 'visa', lodged_date: '2026-03-01' })],
      [],
      [mkCustomer({ id: 'cu1', full_name: '李旻书' })],
      TODAY,
    )
    expect(visaOnly[0].nomElapsed).toBeNull()
    expect(visaOnly[0].nomDaysSince).toBeNull()
    expect(visaOnly[0].visaElapsed).toEqual(elapsedMonthsDays('2026-03-01', TODAY))
  })

  it('可按提名距今 / 签证距今分别排序（缺值排末）', () => {
    const cs = [
      mkCase({ id: 'a', case_number: '1', customer_id: 'cu1', sync_tracking: true }),
      mkCase({ id: 'b', case_number: '2', customer_id: 'cu1', sync_tracking: true }),
    ]
    const lg = [
      mkLodgement({ case_id: 'a', type: 'nomination', lodged_date: '2026-01-01' }),
      mkLodgement({ case_id: 'a', type: 'visa', lodged_date: '2026-05-01' }),
      mkLodgement({ case_id: 'b', type: 'visa', lodged_date: '2026-02-01' }), // 无提名
    ]
    const rows = selectCaseRows(cs, lg, [], [mkCustomer({ id: 'cu1', full_name: '李' })], TODAY)
    // 提名距今降序：a 有提名(149天)、b 无提名(末) → a 在前
    expect(sortCaseRows(rows, 'nomElapsed', 'desc').map((r) => r.caseId)).toEqual(['a', 'b'])
    // 签证距今降序：b(2/1, 更久) 先于 a(5/1)
    expect(sortCaseRows(rows, 'visaElapsed', 'desc').map((r) => r.caseId)).toEqual(['b', 'a'])
  })

  it('有子类别时 visaLabel 合并显示「类别/子类别」', () => {
    const cases = [mkCase({ id: 'c1', customer_id: 'cu1', visa_subclass: '482', visa_stream: 'Core Skills', sync_tracking: true })]
    const lodgements = [mkLodgement({ case_id: 'c1', type: 'visa', lodged_date: '2026-01-01' })]
    const rows = selectCaseRows(cases, lodgements, [ca('c1', 'cu2')], customers, TODAY)
    expect(rows[0].visaLabel).toBe('482/Core Skills')
  })

  it('不同步案件：主申一行(副申空) + 每个副申一行(签证类型 XX 副申请, 主申列写主申名)', () => {
    const cases = [mkCase({ id: 'c1', case_number: '87654321', customer_id: 'cu1', visa_subclass: '186', sync_tracking: false })]
    const lodgements = [mkLodgement({ case_id: 'c1', type: 'visa', lodged_date: '2026-02-01' })]
    const rows = selectCaseRows(cases, lodgements, [ca('c1', 'cu2')], customers, TODAY)
    expect(rows).toHaveLength(2)
    // 同案件主/副相邻，主申在前
    expect(rows[0].role).toBe('primary')
    expect(rows[1].role).toBe('secondary')
    const primaryRow = rows.find((r) => r.role === 'primary')!
    expect(primaryRow).toMatchObject({ primaryName: '李旻书', secondaryName: '', visaLabel: '186', visaLodgedDate: '2026-02-01' })
    const subRow = rows.find((r) => r.role === 'secondary')!
    expect(subRow).toMatchObject({ primaryName: '李旻书', secondaryName: '邓韬', visaLabel: '186 副申请', visaLodgedDate: '2026-02-01' })
  })

  it('未递交案件也显示，排在已递交之后；lodged 标记 + 日期为 null', () => {
    const cases = [
      mkCase({ id: 'old', case_number: '11111111', customer_id: 'cu1', sync_tracking: true }),
      mkCase({ id: 'new', case_number: '22222222', customer_id: 'cu1', sync_tracking: true }),
      mkCase({ id: 'none', case_number: '33333333', customer_id: 'cu1', current_stage: 'drafted', sync_tracking: true }),
    ]
    const lodgements = [
      mkLodgement({ case_id: 'old', type: 'visa', lodged_date: '2026-01-01' }),
      mkLodgement({ case_id: 'new', type: 'visa', lodged_date: '2026-05-01' }),
      mkLodgement({ case_id: 'none', type: 'visa', lodged_date: null }), // 未递交
    ]
    const rows = selectCaseRows(cases, lodgements, [], [mkCustomer({ id: 'cu1', full_name: '李旻书' })], TODAY)
    // old 距今更久 → 在前；未递交的 none 排末
    expect(rows.map((r) => r.caseId)).toEqual(['old', 'new', 'none'])
    const none = rows.find((r) => r.caseId === 'none')!
    expect(none).toMatchObject({ lodged: false, nomLodgedDate: null, visaLodgedDate: null, currentStage: 'drafted' })
    expect(rows.find((r) => r.caseId === 'old')!.lodged).toBe(true)
  })
})

describe('sortCaseRows', () => {
  const customers = [mkCustomer({ id: 'cu1', full_name: '李旻书' }), mkCustomer({ id: 'cu2', full_name: '陈一' })]
  const cases = [
    mkCase({ id: 'c1', case_number: '20000000', customer_id: 'cu1', sync_tracking: true }),
    mkCase({ id: 'c2', case_number: '10000000', customer_id: 'cu2', sync_tracking: true }),
  ]
  const lodgements = [
    mkLodgement({ case_id: 'c1', type: 'visa', lodged_date: '2026-01-01' }),
    mkLodgement({ case_id: 'c2', type: 'visa', lodged_date: '2026-04-01' }),
  ]
  const rows = selectCaseRows(cases, lodgements, [], customers, TODAY)

  it('按案件编号升序', () => {
    expect(sortCaseRows(rows, 'caseNumber', 'asc').map((r) => r.caseNumber)).toEqual(['10000000', '20000000'])
  })
  it('按距今升序（最近递交在前）', () => {
    expect(sortCaseRows(rows, 'elapsed', 'asc').map((r) => r.caseId)).toEqual(['c2', 'c1'])
  })
  it('按状态升序（流程顺序：drafted 在 granted 之前）', () => {
    const staged = selectCaseRows(
      [
        mkCase({ id: 'g', case_number: '30000000', customer_id: 'cu1', current_stage: 'granted', sync_tracking: true }),
        mkCase({ id: 'd', case_number: '40000000', customer_id: 'cu2', current_stage: 'drafted', sync_tracking: true }),
      ],
      [
        mkLodgement({ case_id: 'g', type: 'visa', lodged_date: '2026-01-01' }),
        mkLodgement({ case_id: 'd', type: 'visa', lodged_date: '2026-01-01' }),
      ],
      [],
      customers,
      TODAY,
    )
    expect(sortCaseRows(staged, 'stage', 'asc').map((r) => r.caseId)).toEqual(['d', 'g'])
    expect(sortCaseRows(staged, 'stage', 'desc').map((r) => r.caseId)).toEqual(['g', 'd'])
  })
})
