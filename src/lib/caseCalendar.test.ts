import { describe, expect, it } from 'vitest'
import { selectCaseEvents, selectReminderEvents, selectAutoReminderEvents, eventsByDay, localDayOf, matchesEventSearch, CALENDAR_KIND_META } from './caseCalendar'
import type { Case, CaseReminder, CaseStageHistory, Customer, RecordRow } from '../types/models'

const mkCust = (o: Partial<Customer>): Customer => ({
  id: 'P', full_name: '甲', chinese_name: null, english_name: null, birth_date: null, gender: null,
  passport_no: null, nationality: null, phone: null, email: null, wechat: null, address: null,
  sponsor_employer_id: null, sponsor_position: null, referrer_id: null, owner_referrer_id: null,
  primary_applicant_id: null, relationship_to_primary: null, client_source: null, is_starred: false,
  notes: null, assigned_to: null, created_by: null, is_archived: false, created_at: '', updated_at: '', ...o,
})
const mkCase = (o: Partial<Case>): Case => ({
  id: 'ca1', case_number: '99710250', customer_id: 'P', visa_subclass: '482', visa_stream: 'Core Skills',
  case_category: null, case_details: null, destination_country: null, sponsor_position: null, sponsor_employer_id: null,
  immi_account_id: null, current_stage: 'nomination_lodged', currency: 'AUD', sync_tracking: true,
  trt_reminder_enabled: false, trt_reminder_dismissed: false, cohab_reminder_enabled: false, cohab_reminder_last: null,
  parent_case_id: null, parent_sync_progress: false, assigned_to: null, created_by: null, is_archived: false,
  created_at: '', updated_at: '', ...o,
})
const mkHist = (o: Partial<CaseStageHistory>): CaseStageHistory => ({
  id: 'h1', case_id: 'ca1', from_stage: null, to_stage: 'nomination_lodged', note: null, changed_by: null,
  changed_at: '2026-06-01T00:00:00Z', effective_at: '2026-06-01', ...o,
} as CaseStageHistory)
const mkTask = (o: Partial<RecordRow>): RecordRow => ({
  id: 't1', customer_id: 'P', case_id: 'ca1', type: 'task', content: 'Request 体检补材料', due_date: '2026-06-10',
  is_done: false, done_at: null, assigned_to: null, channel: null, emoji_marker: null, created_by: null,
  created_at: '', updated_at: '', ...o,
} as RecordRow)

const customers = { P: mkCust({ id: 'P', chinese_name: '谢华' }) }

describe('localDayOf（事件落本地日，禁 UTC）', () => {
  it('纯日期串原样；时间戳转本地日', () => {
    expect(localDayOf('2026-06-10')).toBe('2026-06-10')
    // 本地构造的深夜时间戳：本地日不变（用本地 getters）
    const localLate = new Date(2026, 5, 30, 23, 0).toISOString() // UTC 串，但取本地日
    expect(localDayOf(localLate)).toBe('2026-06-30')
  })
})

describe('selectCaseEvents（阶段里程碑 + 补件，单点不画跨度）', () => {
  const cases = [mkCase({ id: 'ca1', customer_id: 'P', visa_subclass: '482', visa_stream: 'Core Skills' })]
  const history = [
    mkHist({ id: 'h1', to_stage: 'nomination_lodged', effective_at: '2026-06-03' }),
    mkHist({ id: 'h2', to_stage: 'visa_lodged', effective_at: '2026-06-08' }),
    mkHist({ id: 'h3', to_stage: 'nomination_approved', effective_at: '2026-06-05' }),
    mkHist({ id: 'h4', to_stage: 'granted', effective_at: '2026-06-20' }),
    mkHist({ id: 'h5', to_stage: 'refused', effective_at: '2026-06-22' }),
    mkHist({ id: 'h6', to_stage: 'docs_requested', effective_at: '2026-06-09' }), // 非里程碑 → 不出点
  ]
  const tasks = [mkTask({ id: 't1', due_date: '2026-06-10', content: 'Request 体检补材料' })]

  it('递交=灰、获批/下签=绿、拒签=红、补件=黄；类型与颜色正确；非里程碑阶段不出点', () => {
    const evs = selectCaseEvents(cases, customers, history, tasks)
    const byLabel = Object.fromEntries(evs.map((e) => [e.typeLabel, e]))
    expect(byLabel['提名递交']).toMatchObject({ date: '2026-06-03', kind: 'lodged' })
    expect(byLabel['签证递交']).toMatchObject({ date: '2026-06-08', kind: 'lodged' })
    expect(byLabel['提名获批']).toMatchObject({ date: '2026-06-05', kind: 'approved' })
    expect(byLabel['下签']).toMatchObject({ date: '2026-06-20', kind: 'approved' })
    expect(byLabel['拒签']).toMatchObject({ date: '2026-06-22', kind: 'refused' })
    expect(byLabel['补件']).toMatchObject({ date: '2026-06-10', kind: 'docs', detail: 'Request 体检补材料' })
    expect(evs.find((e) => e.typeLabel === '补件')?.customerName).toBe('谢华')
    // 非里程碑(docs_requested)不出点
    expect(evs.some((e) => e.date === '2026-06-09')).toBe(false)
    // 颜色映射
    expect(CALENDAR_KIND_META.lodged.color).toBe('#7e887e')
    expect(CALENDAR_KIND_META.approved.color).toBe('#357a52')
    expect(CALENDAR_KIND_META.refused.color).toBe('#c0392b')
    expect(CALENDAR_KIND_META.docs.color).toBe('#c08a2e')
  })

  it('已完成 / 无截止日 / 无 case 的待办不出补件点', () => {
    const t = [
      mkTask({ id: 'done', is_done: true, due_date: '2026-06-11' }),
      mkTask({ id: 'nodue', due_date: null }),
      mkTask({ id: 'nocase', case_id: null, due_date: '2026-06-12' }),
    ]
    const evs = selectCaseEvents(cases, customers, [], t)
    expect(evs).toHaveLength(0)
  })

  it('事件携带跳转所需 caseId/customerId/案件号/签证', () => {
    const evs = selectCaseEvents(cases, customers, [mkHist({ id: 'h1', to_stage: 'granted', effective_at: '2026-06-20' })], [])
    expect(evs[0]).toMatchObject({ caseId: 'ca1', customerId: 'P', caseNumber: '99710250', visaLabel: '482/Core Skills' })
  })
})

const mkRem = (o: Partial<CaseReminder>): CaseReminder => ({
  id: 'r1', case_id: 'ca1', content: '更新同居材料', base_date: '2026-06-01', offset_value: 0, offset_unit: 'day',
  repeat_rule: 'never', enabled: true, created_by: null, created_at: '2026-06-01', ...o,
} as CaseReminder)

describe('selectReminderEvents（自定义提醒 = 紫点，到期 = base_date + offset，按月推算）', () => {
  const cases = [mkCase({ id: 'ca1', customer_id: 'P', visa_subclass: '186', visa_stream: 'Temporary Residence Transition' })]
  it('基准日 offset 0 落在该月 → 紫点；停用不出；案件不存在跳过', () => {
    const rems = [
      mkRem({ id: 'r1', base_date: '2026-06-01', offset_value: 0, offset_unit: 'day', repeat_rule: 'never', content: '办 186 TRT' }),
      mkRem({ id: 'r2', enabled: false, base_date: '2026-06-05', content: '停用的' }),
      mkRem({ id: 'r3', case_id: 'nope', content: '野案件' }),
    ]
    const evs = selectReminderEvents(rems, cases, customers, '2026-06')
    expect(evs).toHaveLength(1)
    expect(evs[0]).toMatchObject({ date: '2026-06-01', kind: 'reminder', typeLabel: '提醒', detail: '办 186 TRT', caseId: 'ca1', customerId: 'P' })
    expect(CALENDAR_KIND_META.reminder.color).toBe('#7c6fd6')
  })
  it('offset 月把首期从基准日推到别的月 → 当月不出', () => {
    const rems = [mkRem({ base_date: '2026-06-01', offset_value: 2, offset_unit: 'month' })] // → 2026-08-01
    expect(selectReminderEvents(rems, cases, customers, '2026-06')).toHaveLength(0)
    expect(selectReminderEvents(rems, cases, customers, '2026-08')).toHaveLength(1)
  })
  it('每月重复 → 当月对应日出点', () => {
    const rems = [mkRem({ base_date: '2026-01-10', offset_value: 0, offset_unit: 'day', repeat_rule: 'monthly' })]
    expect(selectReminderEvents(rems, cases, customers, '2026-06')[0].date).toBe('2026-06-10')
  })
})

describe('selectAutoReminderEvents（现有 TRT / 同居材料统一紫点）', () => {
  it('TRT：下签满 2 年（grant + 24 月）紫点；启用且未关闭、客户无 186 TRT 案', () => {
    const cases = [mkCase({ id: 'ca1', customer_id: 'P', visa_subclass: '482', trt_reminder_enabled: true, current_stage: 'granted' })]
    const hist = [mkHist({ id: 'g', to_stage: 'granted', effective_at: '2024-06-16' })]
    const evs = selectAutoReminderEvents(cases, customers, hist, '2026-06')
    expect(evs).toHaveLength(1)
    expect(evs[0]).toMatchObject({ date: '2026-06-16', kind: 'reminder', typeLabel: 'TRT 提醒' })
  })
  it('TRT 关闭(dismissed) → 不出', () => {
    const cases = [mkCase({ id: 'ca1', visa_subclass: '482', trt_reminder_enabled: true, trt_reminder_dismissed: true })]
    expect(selectAutoReminderEvents(cases, customers, [mkHist({ to_stage: 'granted', effective_at: '2024-06-16' })], '2026-06')).toHaveLength(0)
  })
  it('同居材料：186/配偶签每 3 月循环；锚点=上次确认 → +3 月落点', () => {
    const cases = [mkCase({ id: 'ca1', visa_subclass: '186', cohab_reminder_enabled: true, cohab_reminder_last: '2026-03-10', current_stage: 'visa_lodged' })]
    const evs = selectAutoReminderEvents(cases, customers, [], '2026-06')
    expect(evs).toHaveLength(1)
    expect(evs[0]).toMatchObject({ date: '2026-06-10', kind: 'reminder', typeLabel: '补材料提醒' })
  })
})

describe('matchesEventSearch（客户名 / 案件号 / 事件类型）', () => {
  const ev = { customerName: '谢华', caseNumber: '99710250', typeLabel: '提名递交' }
  it('空 → 全命中；命中名/号/类型；不相关不命中', () => {
    expect(matchesEventSearch(ev, '')).toBe(true)
    expect(matchesEventSearch(ev, '谢华')).toBe(true)
    expect(matchesEventSearch(ev, '99710250')).toBe(true)
    expect(matchesEventSearch(ev, '递交')).toBe(true)
    expect(matchesEventSearch(ev, '下签')).toBe(false)
  })
})

describe('eventsByDay', () => {
  it('按本地日期归集，同日内提醒/补件在递交/获批之前', () => {
    const cases = [mkCase({ id: 'ca1' })]
    const evs = selectCaseEvents(
      cases,
      customers,
      [mkHist({ id: 'h1', to_stage: 'granted', effective_at: '2026-06-10' })],
      [mkTask({ id: 't1', due_date: '2026-06-10', content: '补料' })],
    )
    const map = eventsByDay(evs)
    expect(map.get('2026-06-10')?.map((e) => e.kind)).toEqual(['docs', 'approved'])
    expect(map.has('2026-06-03')).toBe(false)
  })
})
