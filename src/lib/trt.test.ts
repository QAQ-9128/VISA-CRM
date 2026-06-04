import { describe, expect, it } from 'vitest'
import { shouldShowTrtReminder, monthsSinceGrant, selectTrtReminders } from './trt'
import type { Case } from '../types/models'
import type { CaseStageHistory } from '../types/models'

const mkCase = (o: Partial<Case>): Case => ({
  id: 'c1', case_number: '48200001', customer_id: 'cu1', visa_subclass: '482', visa_stream: null,
  current_stage: 'granted', currency: 'AUD', sync_tracking: true, destination_country: null, sponsor_position: null, sponsor_employer_id: null,
  assigned_to: null, created_by: null, is_archived: false, trt_reminder_enabled: true, parent_case_id: null, parent_sync_progress: false,
  created_at: '', updated_at: '', ...o,
})
const mkHist = (case_id: string, to_stage: CaseStageHistory['to_stage'], effective_at: string, id = `${case_id}-${to_stage}`): CaseStageHistory => ({
  id, case_id, from_stage: null, to_stage, note: null, changed_by: null, changed_at: effective_at, effective_at,
})

const TODAY = new Date(2026, 0, 1) // 2024-01-01 下签 → 约 731 天 ≥ 660
const grantedLongAgo = [mkHist('c1', 'granted', '2024-01-01T00:00:00Z')]

describe('shouldShowTrtReminder', () => {
  const base = mkCase({ id: 'c1', customer_id: 'cu1', visa_subclass: '482', trt_reminder_enabled: true })

  it('全部条件满足 → true', () => {
    expect(shouldShowTrtReminder(base, [base], grantedLongAgo, TODAY)).toBe(true)
  })
  it('未勾选提醒 → false', () => {
    const off = mkCase({ id: 'c1', customer_id: 'cu1', trt_reminder_enabled: false })
    expect(shouldShowTrtReminder(off, [off], grantedLongAgo, TODAY)).toBe(false)
  })
  it('没有下签历史 → false', () => {
    const hist = [mkHist('c1', 'visa_lodged', '2024-01-01T00:00:00Z')]
    expect(shouldShowTrtReminder(base, [base], hist, TODAY)).toBe(false)
  })
  it('下签未满 22 个月(660 天) → false', () => {
    const recent = [mkHist('c1', 'granted', '2025-08-01T00:00:00Z')] // ~153 天
    expect(shouldShowTrtReminder(base, [base], recent, TODAY)).toBe(false)
  })
  it('客户已开 186 TRT 案 → false（提醒消失）', () => {
    const trt = mkCase({ id: 'c2', customer_id: 'cu1', visa_subclass: '186', visa_stream: 'Temporary Residence Transition' })
    expect(shouldShowTrtReminder(base, [base, trt], grantedLongAgo, TODAY)).toBe(false)
  })
  it('客户有 186 但非 TRT stream（Direct Entry）→ 仍 true', () => {
    const de = mkCase({ id: 'c2', customer_id: 'cu1', visa_subclass: '186', visa_stream: 'Direct Entry' })
    expect(shouldShowTrtReminder(base, [base, de], grantedLongAgo, TODAY)).toBe(true)
  })
})

describe('monthsSinceGrant', () => {
  it('floor(距下签天数 / 30)', () => {
    expect(monthsSinceGrant([mkHist('c1', 'granted', '2026-01-01T00:00:00Z')], new Date(2026, 2, 1))).toBe(1) // 59 天
  })
  it('没有下签 → null', () => {
    expect(monthsSinceGrant([], new Date(2026, 2, 1))).toBeNull()
  })
})

describe('selectTrtReminders', () => {
  const customerById = { cu1: { full_name: '王芳' } }

  it('聚合符合条件的案件，带客户名/案件号/距下签月数', () => {
    const c1 = mkCase({ id: 'c1', customer_id: 'cu1', visa_subclass: '482', case_number: '48200001', trt_reminder_enabled: true })
    const r = selectTrtReminders([c1], grantedLongAgo, customerById, TODAY)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ customerId: 'cu1', customerName: '王芳', caseId: 'c1', caseNumber: '48200001' })
    expect(r[0].monthsSinceGrant).toBeGreaterThanOrEqual(22)
  })
  it('不符合条件的不列出（未勾选 / 已开 186TRT）', () => {
    const off = mkCase({ id: 'c1', customer_id: 'cu1', trt_reminder_enabled: false })
    expect(selectTrtReminders([off], grantedLongAgo, customerById, TODAY)).toEqual([])
    const c1 = mkCase({ id: 'c1', customer_id: 'cu1', visa_subclass: '482', trt_reminder_enabled: true })
    const trt = mkCase({ id: 'c2', customer_id: 'cu1', visa_subclass: '186', visa_stream: 'Temporary Residence Transition' })
    expect(selectTrtReminders([c1, trt], grantedLongAgo, customerById, TODAY)).toEqual([])
  })
})
