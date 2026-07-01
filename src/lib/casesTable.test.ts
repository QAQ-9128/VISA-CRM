import { describe, expect, it } from 'vitest'
import {
  calculateWaitDays,
  clusterRowsByGroup,
  groupPositions,
  elapsedMonthsDays,
  flowProcessing,
  formatElapsed,
  selectCaseRows,
  sortCaseRows,
  summarizeProgress,
} from './casesTable'
import type { CaseRow } from './casesTable'
import type { Case, CaseApplicant, CaseStageHistory, Customer, Lodgement } from '../types/models'

const TODAY = new Date(2026, 4, 29) // 2026-05-29

const mkCase = (o: Partial<Case>): Case => ({
  id: 'c1', case_number: '00000001', customer_id: 'cu1', visa_subclass: '482', visa_stream: null, case_category: null, case_details: null, current_stage: 'visa_lodged',
  currency: 'AUD', sync_tracking: true, trt_reminder_enabled: false, trt_reminder_dismissed: false, cohab_reminder_enabled: false, cohab_reminder_last: null, parent_case_id: null, parent_sync_progress: false, destination_country: 'Australia', sponsor_position: null, sponsor_employer_id: null, immi_account_id: null, assigned_to: null, created_by: null,
  is_archived: false, created_at: '', updated_at: '2026-05-20T00:00:00Z', ...o,
})
const mkCustomer = (o: Partial<Customer>): Customer => ({
  id: 'cu1', full_name: '李旻书', is_starred: false, client_source: null, primary_applicant_id: null,
  relationship_to_primary: null, birth_date: null, gender: null, passport_no: null, nationality: null, phone: null,
  chinese_name: null, english_name: null,
  email: null, wechat: null, address: null, sponsor_employer_id: null, sponsor_position: null, referrer_id: null, owner_referrer_id: null, notes: null,
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
      primaryCustomerId: 'cu1',
      secondaryName: '邓韬',
      secondaryCustomerIds: ['cu2'],
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

  it('显示名统一解析（进度表参与人名）：中文优先；只有英文显英文（原样）', () => {
    const cases = [mkCase({ id: 'c1', customer_id: 'cu1', current_stage: 'todo' })]
    const zh = selectCaseRows(
      cases, [], [],
      [mkCustomer({ id: 'cu1', full_name: 'DENG Tao', chinese_name: '邓韬', english_name: 'DENG Tao' })],
      TODAY, [],
    )
    expect(zh[0].primaryName).toBe('邓韬')
    const en = selectCaseRows(
      cases, [], [],
      [mkCustomer({ id: 'cu1', full_name: '旧名', english_name: 'LI Minshu' })],
      TODAY, [],
    )
    expect(en[0].primaryName).toBe('LI Minshu')
  })

  it('获批标记：下签案件 nomApproved+visaGranted 全真；距今数值与改前一致（计算不动）', () => {
    const cases = [mkCase({ id: 'c1', customer_id: 'cu1', current_stage: 'granted', sync_tracking: true })]
    const history = [
      lodgedH('c1', 'nomination', '2026-01-01'),
      lodgedH('c1', 'visa', '2026-01-01'),
      mkHistory({ case_id: 'c1', to_stage: 'granted', effective_at: '2026-01-10T00:00:00Z' }),
    ]
    const r = selectCaseRows(cases, [], [], [mkCustomer({ id: 'cu1', full_name: '李' })], TODAY, history)[0]
    expect(r.nomApproved).toBe(true)
    expect(r.visaGranted).toBe(true)
    expect(r.nomDaysSince).toBe(9) // 计算口径不变（冻结到决定日）
  })

  it('获批标记：仅提名获批 → nomApproved true / visaGranted false；递交中 → 双 false', () => {
    const cu = [mkCustomer({ id: 'cu1', full_name: '李' })]
    const approved = selectCaseRows(
      [mkCase({ id: 'c1', customer_id: 'cu1', current_stage: 'nomination_approved' })],
      [], [], cu, TODAY,
      [lodgedH('c1', 'nomination', '2026-01-01')],
    )[0]
    expect(approved.nomApproved).toBe(true)
    expect(approved.visaGranted).toBe(false)
    const pending = selectCaseRows(
      [mkCase({ id: 'c1', customer_id: 'cu1', current_stage: 'nomination_lodged' })],
      [], [], cu, TODAY,
      [lodgedH('c1', 'nomination', '2026-01-01')],
    )[0]
    expect(pending.nomApproved).toBe(false)
    expect(pending.visaGranted).toBe(false)
  })

  it('案件客户已归档：首位在册参与人顶上（显示与链接都切过去），归档者不再显示', () => {
    const cases = [mkCase({ id: 'c1', customer_id: 'archivedOwner' })]
    const customers = [mkCustomer({ id: 'cu2', full_name: '邓韬' })] // 在册的只有参与人
    const rows = selectCaseRows(cases, [], [ca('c1', 'cu2')], customers, TODAY, [lodgedH('c1', 'visa', '2026-01-01')])
    expect(rows[0].primaryName).toBe('邓韬')
    expect(rows[0].primaryCustomerId).toBe('cu2') // 链接跳到没被归档的人
    expect(rows[0].secondaryName).toBe('')
  })

  it('获批标记：纯签证案件（从无提名）下签 → visaGranted true 但 nomApproved false（无提名不冒充获批）', () => {
    const r = selectCaseRows(
      [mkCase({ id: 'c1', customer_id: 'cu1', current_stage: 'granted', visa_subclass: '600' })],
      [], [], [mkCustomer({ id: 'cu1', full_name: '李' })], TODAY,
      [lodgedH('c1', 'visa', '2026-01-01'), mkHistory({ case_id: 'c1', to_stage: 'granted', effective_at: '2026-02-01T00:00:00Z' })],
    )[0]
    expect(r.visaGranted).toBe(true)
    expect(r.nomApproved).toBe(false)
    expect(r.nomDaysSince).toBeNull()
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

describe('flowProcessing（单流程审理时长——进度表与案件单页里程碑卡共用的单一来源）', () => {
  it('审理中：时长 = 递交 → 今天，实时累计；approved=false', () => {
    const hist = [lodgedH('c1', 'visa', '2026-03-01')]
    const p = flowProcessing('visa', 'visa_lodged', hist, TODAY)
    expect(p).toMatchObject({ lodged: '2026-03-01', approved: false, daysSince: 89 })
    expect(p.elapsed).toEqual({ months: 2, days: 29 })
    // 实时增长：换更晚的今天数值变大
    expect(flowProcessing('visa', 'visa_lodged', hist, new Date(2026, 5, 28)).daysSince).toBe(119)
  })

  it('已获批定格：提名 = 递交 → 提名获批日；签证 = 递交 → 下签日；仍有值（常显）', () => {
    const hist = [
      lodgedH('c1', 'nomination', '2026-01-01'),
      mkHistory({ id: 'na', case_id: 'c1', to_stage: 'nomination_approved', effective_at: '2026-02-15T00:00:00Z' }),
      lodgedH('c1', 'visa', '2026-02-20'),
      mkHistory({ id: 'g', case_id: 'c1', to_stage: 'granted', effective_at: '2026-04-01T00:00:00Z' }),
    ]
    const nom = flowProcessing('nomination', 'granted', hist, TODAY)
    expect(nom).toMatchObject({ approved: true, daysSince: 45 }) // 1/1 → 2/15 定格
    const visa = flowProcessing('visa', 'granted', hist, TODAY)
    expect(visa).toMatchObject({ approved: true, daysSince: 40 }) // 2/20 → 4/1 定格
    // 定格：今天再晚也不变
    expect(flowProcessing('nomination', 'granted', hist, new Date(2026, 11, 1)).daysSince).toBe(45)
  })

  it('无递交日 → lodged null、时长 null（UI 显 —）', () => {
    const p = flowProcessing('visa', 'todo', [], TODAY)
    expect(p).toMatchObject({ lodged: null, approved: false, daysSince: null, elapsed: null })
  })

  it('纯签证案件（无提名证据）下签：提名 approved=false（不冒充获批）', () => {
    const hist = [
      lodgedH('c1', 'visa', '2026-01-01'),
      mkHistory({ id: 'g', case_id: 'c1', to_stage: 'granted', effective_at: '2026-02-01T00:00:00Z' }),
    ]
    expect(flowProcessing('nomination', 'granted', hist, TODAY).approved).toBe(false)
  })

  it('拒签冻结：未获批流程时长冻结到拒签日', () => {
    const hist = [
      lodgedH('c1', 'nomination', '2026-01-01'),
      mkHistory({ id: 'rf', case_id: 'c1', to_stage: 'refused', effective_at: '2026-03-01T00:00:00Z' }),
    ]
    const p = flowProcessing('nomination', 'refused', hist, TODAY)
    expect(p.daysSince).toBe(59) // 1/1 → 3/1
    expect(p.approved).toBe(false)
  })
})

describe('审理时长（按流程各自定格）+ 提名/签证状态', () => {
  const cu = [mkCustomer({ id: 'cu1', full_name: '李' })]

  it('提名已获批：提名时长 = 递交 → 提名获批日，定格；签证未决 = 递交 → 今天，实时累计', () => {
    const cases = [mkCase({ id: 'c1', customer_id: 'cu1', current_stage: 'visa_lodged' })]
    const history = [
      lodgedH('c1', 'nomination', '2026-01-01'),
      mkHistory({ id: 'na', case_id: 'c1', to_stage: 'nomination_approved', effective_at: '2026-02-15T00:00:00Z' }),
      lodgedH('c1', 'visa', '2026-03-01'),
    ]
    const r = selectCaseRows(cases, [], [], cu, TODAY, history)[0]
    expect(r.nomDaysSince).toBe(45) // 1/1 → 2/15（获批日）定格
    expect(r.visaDaysSince).toBe(89) // 3/1 → 5/29（今天）实时
    // 换更晚的「今天」：提名定格不变，签证继续增长
    const later = selectCaseRows(cases, [], [], cu, new Date(2026, 5, 28), history)[0] // 2026-06-28
    expect(later.nomDaysSince).toBe(45)
    expect(later.visaDaysSince).toBe(119)
  })

  it('下签：签证时长 = 递交 → 下签日定格；提名时长 = 递交 → 提名获批日（不是下签日）；时长仍有值（UI 常显）', () => {
    const cases = [mkCase({ id: 'c1', customer_id: 'cu1', current_stage: 'granted' })]
    const history = [
      lodgedH('c1', 'nomination', '2026-01-01'),
      mkHistory({ id: 'na', case_id: 'c1', to_stage: 'nomination_approved', effective_at: '2026-02-01T00:00:00Z' }),
      lodgedH('c1', 'visa', '2026-02-10'),
      mkHistory({ id: 'g', case_id: 'c1', to_stage: 'granted', effective_at: '2026-04-01T00:00:00Z' }),
    ]
    const r = selectCaseRows(cases, [], [], cu, TODAY, history)[0]
    expect(r.nomDaysSince).toBe(31) // 1/1 → 2/1 提名获批日
    expect(r.visaDaysSince).toBe(50) // 2/10 → 4/1 下签日
    expect(r.nomElapsed).toEqual({ months: 1, days: 1 })
    expect(r.visaElapsed).toEqual({ months: 1, days: 20 })
    expect(r.nomStatus).toBe('approved')
    expect(r.visaStatus).toBe('approved')
  })

  it('状态：审理中流程 pending；未递交流程 null（UI 显 —）', () => {
    const cases = [mkCase({ id: 'c1', customer_id: 'cu1', current_stage: 'nomination_lodged' })]
    const r = selectCaseRows(cases, [], [], cu, TODAY, [lodgedH('c1', 'nomination', '2026-01-01')])[0]
    expect(r.nomStatus).toBe('pending')
    expect(r.visaStatus).toBeNull() // 签证未递交
  })

  it('拒签：被拒流程状态 refused，时长冻结到拒签日（不再增长）', () => {
    const cases = [mkCase({ id: 'c1', customer_id: 'cu1', current_stage: 'refused' })]
    const history = [
      lodgedH('c1', 'nomination', '2026-01-01'),
      mkHistory({ id: 'rf', case_id: 'c1', to_stage: 'refused', effective_at: '2026-03-01T00:00:00Z' }),
    ]
    const r = selectCaseRows(cases, [], [], cu, TODAY, history)[0]
    expect(r.nomStatus).toBe('refused')
    expect(r.nomDaysSince).toBe(59) // 1/1 → 3/1 拒签日冻结
    expect(r.visaStatus).toBeNull()
  })

  it('可按提名/签证状态排序（null 排末，pending < refused < approved 升序）', () => {
    const cs = [
      mkCase({ id: 'a', case_number: '1', customer_id: 'cu1', current_stage: 'granted' }),
      mkCase({ id: 'b', case_number: '2', customer_id: 'cu1', current_stage: 'visa_lodged' }),
    ]
    const history = [
      lodgedH('a', 'visa', '2026-01-01'),
      mkHistory({ id: 'g', case_id: 'a', to_stage: 'granted', effective_at: '2026-02-01T00:00:00Z' }),
      lodgedH('b', 'visa', '2026-01-01'),
    ]
    const rows = selectCaseRows(cs, [], [], cu, TODAY, history)
    expect(sortCaseRows(rows, 'visaStatus', 'asc').map((r) => r.caseId)).toEqual(['b', 'a'])
    expect(sortCaseRows(rows, 'visaStatus', 'desc').map((r) => r.caseId)).toEqual(['a', 'b'])
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

describe('CaseRow.groupCode + clusterRowsByGroup（一案一组：组=本案参与人集合）', () => {
  const groupCustomers = [
    mkCustomer({ id: 'A', full_name: '甲' }),
    mkCustomer({ id: 'B', full_name: '乙' }),
    mkCustomer({ id: 'C', full_name: '丙' }),
  ]

  it('同参与人集合 ⇒ 同组同码（A+B 办两个案 → 两案同组；与 owner 无关）', () => {
    const cases = [
      mkCase({ id: 'c1', customer_id: 'A' }),
      mkCase({ id: 'c2', customer_id: 'B' }),
    ]
    const rows = selectCaseRows(cases, [], [ca('c1', 'B'), ca('c2', 'A')], groupCustomers, TODAY, [])
    const code = rows[0].groupCode
    expect(code).toMatch(/^G-[0-9A-Z]{4}$/)
    expect(rows.every((r) => r.groupCode === code)).toBe(true)
  })

  it('A+B 案与 A+C 案是不同的组（不按客户传递合并）；A 的独立案件又是另一组', () => {
    const cases = [
      mkCase({ id: 'c1', customer_id: 'A' }), // A+B
      mkCase({ id: 'c2', customer_id: 'A' }), // A+C
      mkCase({ id: 'c3', customer_id: 'A' }), // A 独立
    ]
    const rows = selectCaseRows(cases, [], [ca('c1', 'B'), ca('c2', 'C')], groupCustomers, TODAY, [])
    const codes = new Map(rows.map((r) => [r.caseId, r.groupCode]))
    expect(new Set(codes.values()).size).toBe(3) // 三个案件三个组
  })

  it('clusterRowsByGroup：同组相邻；组顺序=各组首行位置；组内保持原序', () => {
    const rows = [
      { groupCode: 'G-A', k: 1 },
      { groupCode: 'G-B', k: 2 },
      { groupCode: 'G-A', k: 3 },
      { groupCode: 'G-C', k: 4 },
      { groupCode: 'G-B', k: 5 },
    ]
    expect(clusterRowsByGroup(rows).map((r) => r.k)).toEqual([1, 3, 2, 5, 4])
  })

  it('同一个人的两个独立案件 → 两个组（不会聚在同一个组头下）', () => {
    const cases = [mkCase({ id: 'c1', customer_id: 'A' }), mkCase({ id: 'c2', customer_id: 'A' })]
    const rows = selectCaseRows(cases, [], [], groupCustomers, TODAY, [])
    expect(rows[0].groupCode).not.toBe(rows[1].groupCode)
  })

  it('排序键 group：按组码排序', () => {
    const cases = [mkCase({ id: 'c1', customer_id: 'A' }), mkCase({ id: 'c9', customer_id: 'C' })]
    const rows = selectCaseRows(cases, [], [], groupCustomers, TODAY, [])
    const asc = sortCaseRows(rows, 'group', 'asc').map((r) => r.groupCode)
    expect(asc).toEqual([...asc].sort())
  })

  it('groupPositions：组首行 span=组行数（其余 null）、start/end/multi 标记正确（画组框用）', () => {
    const rows = [
      { groupCode: 'G-A' }, { groupCode: 'G-A' }, { groupCode: 'G-A' },
      { groupCode: 'G-B' },
    ]
    expect(groupPositions(rows)).toEqual([
      { span: 3, start: true, end: false, multi: true },
      { span: null, start: false, end: false, multi: true },
      { span: null, start: false, end: true, multi: true },
      { span: 1, start: true, end: true, multi: false },
    ])
    expect(groupPositions([])).toEqual([])
  })
})

describe('summarizeProgress（页头汇总粒：在审 / 待递交 / 已获批 / 已终止）', () => {
  const r = (over: Partial<CaseRow>): CaseRow =>
    ({ rowKey: 'x', caseId: 'x', caseNumber: '0', groupCode: 'G', role: 'merged', primaryName: '甲',
      primaryCustomerId: 'c', secondaryName: '', secondaryCustomerIds: [], visaLabel: '482', visaSubclass: '482',
      currentStage: 'visa_lodged', lodged: true, nomLodgedDate: null, visaLodgedDate: '2026-01-01', daysSince: 1,
      elapsed: { months: 0, days: 1 }, nomDaysSince: null, nomElapsed: null, visaDaysSince: 1, visaElapsed: { months: 0, days: 1 },
      frozen: false, nomApproved: false, visaGranted: false, nomStatus: null, visaStatus: 'pending', nomDhaDays: null,
      visaDhaDays: null, updatedAt: '', ...over }) as CaseRow

  it('未递交 → 待递交；下签/提名获批 → 已获批；拒签 → 已终止；其余已递交 → 在审', () => {
    const s = summarizeProgress([
      r({ lodged: false, currentStage: 'todo' }), // 待递交
      r({ lodged: true, currentStage: 'visa_lodged' }), // 在审
      r({ lodged: true, currentStage: 'docs_requested' }), // 在审（需行动也算在审中）
      r({ lodged: true, currentStage: 'granted' }), // 已获批
      r({ lodged: true, currentStage: 'nomination_approved' }), // 已获批
      r({ lodged: true, currentStage: 'refused' }), // 已终止
    ])
    expect(s).toEqual({ pending: 1, inReview: 2, approved: 2, terminated: 1, total: 6 })
  })

  it('空输入 → 全 0', () => {
    expect(summarizeProgress([])).toEqual({ pending: 0, inReview: 0, approved: 0, terminated: 0, total: 0 })
  })
})
