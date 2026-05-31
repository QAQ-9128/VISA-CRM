import { describe, expect, it } from 'vitest'
import {
  calculateWaitDays,
  elapsedMonthsDays,
  formatElapsed,
  joinFamilyNames,
  selectCaseRows,
  sortCaseRows,
} from './casesTable'
import type { Case, CaseApplicant, CaseStageHistory, Customer, Lodgement } from '../types/models'

const TODAY = new Date(2026, 4, 29) // 2026-05-29

const mkCase = (o: Partial<Case>): Case => ({
  id: 'c1', case_number: '00000001', customer_id: 'cu1', visa_subclass: '482', visa_stream: null, current_stage: 'visa_lodged',
  currency: 'AUD', sync_tracking: true, trt_reminder_enabled: false, parent_case_id: null, parent_sync_progress: false, destination_country: 'Australia', assigned_to: null, created_by: null,
  is_archived: false, created_at: '', updated_at: '2026-05-20T00:00:00Z', ...o,
})
const mkCustomer = (o: Partial<Customer>): Customer => ({
  id: 'cu1', full_name: '李旻书', is_starred: false, client_source: null, primary_applicant_id: null,
  relationship_to_primary: null, birth_date: null, gender: null, passport_no: null, nationality: null, phone: null,
  email: null, wechat: null, address: null, sponsor_employer_id: null, sponsor_position: null, referrer_id: null, notes: null,
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
const mkHistory = (o: Partial<CaseStageHistory>): CaseStageHistory => ({
  id: 'h1', case_id: 'c1', from_stage: null, to_stage: 'granted', note: null, changed_by: null,
  changed_at: '2026-01-10T00:00:00Z', effective_at: '2026-01-10T00:00:00Z', ...o,
})
// 递交日期现在从 stage_history 派生：构造一条「提名递交/签证递交」历史条目（effective_at=该日）
const lodgedH = (caseId: string, type: 'nomination' | 'visa', date: string): CaseStageHistory =>
  mkHistory({
    id: `${caseId}-${type}-${date}`,
    case_id: caseId,
    to_stage: type === 'nomination' ? 'nomination_lodged' : 'visa_lodged',
    effective_at: `${date}T00:00:00Z`,
  })

describe('calculateWaitDays', () => {
  it('未决：递交 → 今天，继续增长，不冻结（/30 近似）', () => {
    const r = calculateWaitDays('2026-01-01', 'c1', [], new Date(2026, 2, 1)) // 2026-03-01 = 59 天
    expect(r).toEqual({ lodged: true, frozen: false, totalDays: 59, months: 1, days: 29, label: '1 个月 29 天' })
  })

  it('已决（有下签/拒签历史）：递交 → 决定日，冻结，不随今天增长', () => {
    const history = [mkHistory({ case_id: 'c1', to_stage: 'granted', effective_at: '2026-02-15T03:00:00Z' })]
    const r = calculateWaitDays('2026-01-01', 'c1', history, new Date(2026, 11, 1)) // 45 天
    expect(r).toEqual({ lodged: true, frozen: true, totalDays: 45, months: 1, days: 15, label: '1 个月 15 天' })
  })

  it('/30 月天换算 + 格式化规则（对齐客户 Excel）', () => {
    const f = (lodged: string, today: Date) => calculateWaitDays(lodged, 'c1', [], today).label
    // 2025-11-11 → 2026-02-11 = 92 天
    expect(f('2025-11-11', new Date(2026, 1, 11))).toBe('3 个月 2 天')
    // 2025-11-12 → 2026-02-11 = 91 天
    expect(f('2025-11-12', new Date(2026, 1, 11))).toBe('3 个月 1 天')
    // 90 天 → 3 个月 0 天（允许 Y=0）
    expect(f('2025-11-13', new Date(2026, 1, 11))).toBe('3 个月 0 天')
    // 29 天 → 不带"个月"
    expect(f('2026-01-01', new Date(2026, 0, 30))).toBe('29 天')
    // 0 天
    expect(f('2026-01-01', new Date(2026, 0, 1))).toBe('0 天')
  })

  it('已结案：frozen=true（UI 在 label 后追加"（已结案）"）', () => {
    const history = [mkHistory({ case_id: 'c1', to_stage: 'granted', effective_at: '2026-02-11T00:00:00Z' })]
    const r = calculateWaitDays('2025-11-11', 'c1', history, new Date(2026, 5, 1)) // 冻结到 2/11 = 92 天
    expect(r.frozen).toBe(true)
    expect(r.label).toBe('3 个月 2 天')
  })

  it('多条终态历史取最晚决定日；只认本案件', () => {
    const history = [
      mkHistory({ id: 'h1', case_id: 'c1', to_stage: 'refused', effective_at: '2026-02-10T00:00:00Z' }),
      mkHistory({ id: 'h2', case_id: 'c1', to_stage: 'granted', effective_at: '2026-03-01T00:00:00Z' }),
      mkHistory({ id: 'h3', case_id: 'other', to_stage: 'granted', effective_at: '2026-09-01T00:00:00Z' }),
    ]
    const r = calculateWaitDays('2026-01-01', 'c1', history, new Date(2026, 11, 1))
    expect(r.frozen).toBe(true)
    expect(r.totalDays).toBe(59) // 2026-01-01 → 2026-03-01
  })

  it('无递交日期 → 不可计，label —', () => {
    const r = calculateWaitDays(null, 'c1', [], new Date(2026, 2, 1))
    expect(r).toMatchObject({ lodged: false, totalDays: 0, label: '—' })
  })
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

  it('同步案件一行：主申+副申分列，提名/签证日期(派生)，距今取较晚一次递交', () => {
    const cases = [mkCase({ id: 'c1', case_number: '12345678', customer_id: 'cu1', visa_subclass: '482', sync_tracking: true })]
    const history = [lodgedH('c1', 'nomination', '2026-01-01'), lodgedH('c1', 'visa', '2026-03-01')]
    const rows = selectCaseRows(cases, [], [ca('c1', 'cu2')], customers, TODAY, history)
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
    expect(rows[0].elapsed).toEqual({ months: 2, days: 29 }) // 取较晚 visa 3/1→5/29 = 89 天 → /30
  })

  it('终态(下签)冻结距今 = 递交日 → 决定日，不到今天', () => {
    const cases = [mkCase({ id: 'c1', customer_id: 'cu1', current_stage: 'granted', sync_tracking: true })]
    const history = [
      lodgedH('c1', 'nomination', '2026-01-01'),
      lodgedH('c1', 'visa', '2026-01-01'),
      mkHistory({ case_id: 'c1', to_stage: 'granted', effective_at: '2026-01-10T00:00:00Z' }),
    ]
    const rows = selectCaseRows(cases, [], [], [mkCustomer({ id: 'cu1', full_name: '李' })], TODAY, history)
    expect(rows[0].visaDaysSince).toBe(9) // 1.1 → 1.10 冻结
    expect(rows[0].nomDaysSince).toBe(9)
  })

  it('未决：距今 = 递交日 → 今天（继续增长）', () => {
    const cases = [mkCase({ id: 'c1', customer_id: 'cu1', current_stage: 'visa_lodged', sync_tracking: true })]
    const history = [lodgedH('c1', 'visa', '2026-01-01')]
    const rows = selectCaseRows(cases, [], [], [mkCustomer({ id: 'cu1', full_name: '李' })], TODAY, history)
    expect(rows[0].visaDaysSince).toBe(148) // 2026-01-01 → 2026-05-29(TODAY)
  })

  it('附带 frozen 与各递交 DHA 天数（供等待天数列着色用）', () => {
    const cu = [mkCustomer({ id: 'cu1', full_name: '李' })]
    const decided = selectCaseRows(
      [mkCase({ id: 'c1', customer_id: 'cu1', current_stage: 'refused' })],
      [mkLodgement({ case_id: 'c1', type: 'visa', lodged_date: '2026-01-01', dha_processing_days: 120 })],
      [], cu, TODAY,
      [mkHistory({ case_id: 'c1', to_stage: 'refused', effective_at: '2026-02-01T00:00:00Z' })],
    )
    expect(decided[0]).toMatchObject({ frozen: true, visaDhaDays: 120, nomDhaDays: null })
    const pending = selectCaseRows(
      [mkCase({ id: 'c1', customer_id: 'cu1', current_stage: 'visa_lodged' })],
      [mkLodgement({ case_id: 'c1', type: 'nomination', lodged_date: '2026-01-01', dha_processing_days: 90 })],
      [], cu, TODAY, [],
    )
    expect(pending[0]).toMatchObject({ frozen: false, nomDhaDays: 90 })
  })

  it('今天就决定 → 递交日到今天的天数；终态但无决定历史 → 回退今天', () => {
    const cu = [mkCustomer({ id: 'cu1', full_name: '李' })]
    const lodged = lodgedH('c1', 'visa', '2026-05-20')
    // 今天(2026-05-29)决定
    const decidedToday = selectCaseRows(
      [mkCase({ id: 'c1', customer_id: 'cu1', current_stage: 'granted', sync_tracking: true })],
      [], [], cu, TODAY,
      [lodged, mkHistory({ case_id: 'c1', to_stage: 'granted', effective_at: '2026-05-29T12:00:00Z' })],
    )
    expect(decidedToday[0].visaDaysSince).toBe(9) // 5.20 → 5.29
    // 终态但没有决定历史 → 回退今天（同样 9 天，因为今天就是 5.29）
    const noHistory = selectCaseRows(
      [mkCase({ id: 'c1', customer_id: 'cu1', current_stage: 'granted', sync_tracking: true })],
      [], [], cu, TODAY, [lodged],
    )
    expect(noHistory[0].visaDaysSince).toBe(9)
  })

  it('跨月冻结：1/20 递交 → 3/5 下签 = 44 天 → 1 个月 14 天（/30）', () => {
    const cases = [mkCase({ id: 'c1', customer_id: 'cu1', current_stage: 'granted', sync_tracking: true })]
    const history = [
      lodgedH('c1', 'visa', '2026-01-20'),
      mkHistory({ case_id: 'c1', to_stage: 'granted', effective_at: '2026-03-05T00:00:00Z' }),
    ]
    const rows = selectCaseRows(cases, [], [], [mkCustomer({ id: 'cu1', full_name: '李' })], TODAY, history)
    expect(rows[0].visaDaysSince).toBe(44)
    expect(rows[0].visaElapsed).toEqual({ months: 1, days: 14 })
  })

  it('提名/签证各自的距今(elapsed/daysSince)分开计算；缺哪边哪边为 null', () => {
    const cases = [mkCase({ id: 'c1', customer_id: 'cu1', sync_tracking: true })]
    const history = [lodgedH('c1', 'nomination', '2026-01-01'), lodgedH('c1', 'visa', '2026-03-01')]
    const rows = selectCaseRows(cases, [], [], [mkCustomer({ id: 'cu1', full_name: '李旻书' })], TODAY, history)
    expect(rows[0].nomElapsed).toEqual({ months: 4, days: 28 }) // 148 天 → /30
    expect(rows[0].visaElapsed).toEqual({ months: 2, days: 29 }) // 89 天 → /30
    expect(rows[0].nomDaysSince).toBe(148) // 2026-01-01 → 2026-05-29
    expect(rows[0].visaDaysSince).toBe(89) // 2026-03-01 → 2026-05-29

    // 只有签证递交 → 提名距今为 null
    const visaOnly = selectCaseRows(
      [mkCase({ id: 'c2', customer_id: 'cu1', sync_tracking: true })],
      [],
      [],
      [mkCustomer({ id: 'cu1', full_name: '李旻书' })],
      TODAY,
      [lodgedH('c2', 'visa', '2026-03-01')],
    )
    expect(visaOnly[0].nomElapsed).toBeNull()
    expect(visaOnly[0].nomDaysSince).toBeNull()
    expect(visaOnly[0].visaElapsed).toEqual({ months: 2, days: 29 }) // 89 天 → /30
  })

  it('可按提名距今 / 签证距今分别排序（缺值排末）', () => {
    const cs = [
      mkCase({ id: 'a', case_number: '1', customer_id: 'cu1', sync_tracking: true }),
      mkCase({ id: 'b', case_number: '2', customer_id: 'cu1', sync_tracking: true }),
    ]
    const history = [
      lodgedH('a', 'nomination', '2026-01-01'),
      lodgedH('a', 'visa', '2026-05-01'),
      lodgedH('b', 'visa', '2026-02-01'), // 无提名
    ]
    const rows = selectCaseRows(cs, [], [], [mkCustomer({ id: 'cu1', full_name: '李' })], TODAY, history)
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

  it('进度始终同步：即便 sync_tracking=false 也合并为一行（主申+副申同列，不拆行）', () => {
    const cases = [mkCase({ id: 'c1', case_number: '87654321', customer_id: 'cu1', visa_subclass: '186', sync_tracking: false })]
    const rows = selectCaseRows(cases, [], [ca('c1', 'cu2')], customers, TODAY, [lodgedH('c1', 'visa', '2026-02-01')])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      role: 'merged',
      primaryName: '李旻书',
      secondaryName: '邓韬',
      visaLabel: '186',
      visaLodgedDate: '2026-02-01',
    })
  })

  it('未递交案件也显示，排在已递交之后；lodged 标记 + 日期为 null', () => {
    const cases = [
      mkCase({ id: 'old', case_number: '11111111', customer_id: 'cu1', sync_tracking: true }),
      mkCase({ id: 'new', case_number: '22222222', customer_id: 'cu1', sync_tracking: true }),
      mkCase({ id: 'none', case_number: '33333333', customer_id: 'cu1', current_stage: 'drafted', sync_tracking: true }),
    ]
    // old/new 有递交历史；none 无 → 未递交
    const history = [lodgedH('old', 'visa', '2026-01-01'), lodgedH('new', 'visa', '2026-05-01')]
    const rows = selectCaseRows(cases, [], [], [mkCustomer({ id: 'cu1', full_name: '李旻书' })], TODAY, history)
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
  const history = [lodgedH('c1', 'visa', '2026-01-01'), lodgedH('c2', 'visa', '2026-04-01')]
  const rows = selectCaseRows(cases, [], [], customers, TODAY, history)

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
      [],
      [],
      customers,
      TODAY,
      [lodgedH('g', 'visa', '2026-01-01'), lodgedH('d', 'visa', '2026-01-01')],
    )
    expect(sortCaseRows(staged, 'stage', 'asc').map((r) => r.caseId)).toEqual(['d', 'g'])
    expect(sortCaseRows(staged, 'stage', 'desc').map((r) => r.caseId)).toEqual(['g', 'd'])
  })
})
