import { describe, expect, it } from 'vitest'
import {
  COHAB_CYCLE_DAYS,
  isCohabEligible,
  monthsSinceCohabAnchor,
  selectCohabReminders,
  shouldShowCohabReminder,
} from './cohab'
import type { Case, CaseStageHistory } from '../types/models'

const mkCase = (o: Partial<Case>): Case => ({
  id: 'c1', case_number: '82000001', customer_id: 'cu1', visa_subclass: '820/801', visa_stream: null, case_category: null, case_details: null,
  current_stage: 'visa_lodged', currency: 'AUD', sync_tracking: true, destination_country: null, sponsor_position: null, sponsor_employer_id: null,
  assigned_to: null, created_by: null, is_archived: false, trt_reminder_enabled: false, trt_reminder_dismissed: false,
  cohab_reminder_enabled: true, cohab_reminder_last: null, parent_case_id: null, parent_sync_progress: false,
  created_at: '2026-01-01T00:00:00Z', updated_at: '', ...o,
})
const mkHist = (case_id: string, to_stage: CaseStageHistory['to_stage'], effective_at: string): CaseStageHistory => ({
  id: `${case_id}-${to_stage}-${effective_at}`, case_id, from_stage: null, to_stage, note: null, changed_by: null,
  changed_at: effective_at, effective_at,
})

const TODAY = new Date(2026, 4, 29) // 2026-05-29（本地日历日）
const lodgedJan = [mkHist('c1', 'visa_lodged', '2026-01-01T00:00:00Z')] // 距 TODAY 148 天

describe('isCohabEligible（186 + 配偶签才有此提醒）', () => {
  it('186 / 820/801 / 309/100 → true；482 / 600 等 → false', () => {
    expect(isCohabEligible({ visa_subclass: '186' })).toBe(true)
    expect(isCohabEligible({ visa_subclass: '820/801' })).toBe(true)
    expect(isCohabEligible({ visa_subclass: '309/100' })).toBe(true)
    expect(isCohabEligible({ visa_subclass: '482' })).toBe(false)
    expect(isCohabEligible({ visa_subclass: '600' })).toBe(false)
    expect(isCohabEligible({ visa_subclass: '407' })).toBe(false)
  })
})

describe('shouldShowCohabReminder（每满 3 个月 = 90 天循环）', () => {
  it('启用 + 递交满 3 个月 → true；不满 → false（COHAB_CYCLE_DAYS=90）', () => {
    expect(COHAB_CYCLE_DAYS).toBe(90)
    expect(shouldShowCohabReminder(mkCase({}), lodgedJan, TODAY)).toBe(true)
    const recent = [mkHist('c1', 'visa_lodged', '2026-04-01T00:00:00Z')] // 58 天
    expect(shouldShowCohabReminder(mkCase({}), recent, TODAY)).toBe(false)
  })

  it('整 90 天当天到点（本地日历日：2/28 → 5/29 = 90 天）；89 天不提醒', () => {
    const h = [mkHist('c1', 'visa_lodged', '2026-02-28T00:00:00Z')]
    expect(shouldShowCohabReminder(mkCase({}), h, TODAY)).toBe(true) // 90 天整
    expect(shouldShowCohabReminder(mkCase({}), h, new Date(2026, 4, 28))).toBe(false) // 89 天
  })

  it('「本次已更新」顺延：cohab_reminder_last 重置锚点 → 不满 90 天不再提醒，满了再次提醒（循环）', () => {
    const updated = mkCase({ cohab_reminder_last: '2026-04-01' }) // 距 TODAY 58 天
    expect(shouldShowCohabReminder(updated, lodgedJan, TODAY)).toBe(false)
    // 下一周期到点（4/1 + 90 = 6/30）再次提醒
    expect(shouldShowCohabReminder(updated, lodgedJan, new Date(2026, 5, 30))).toBe(true)
  })

  it('未勾选 → false；获批/拒签/撤签后停止', () => {
    expect(shouldShowCohabReminder(mkCase({ cohab_reminder_enabled: false }), lodgedJan, TODAY)).toBe(false)
    expect(shouldShowCohabReminder(mkCase({ current_stage: 'granted' }), lodgedJan, TODAY)).toBe(false)
    expect(shouldShowCohabReminder(mkCase({ current_stage: 'refused' }), lodgedJan, TODAY)).toBe(false)
    expect(shouldShowCohabReminder(mkCase({ current_stage: 'withdrawn' }), lodgedJan, TODAY)).toBe(false)
  })

  it('非 186/配偶签即使被打了标记也不提醒（防御：切类型后的脏数据）', () => {
    expect(shouldShowCohabReminder(mkCase({ visa_subclass: '482' }), lodgedJan, TODAY)).toBe(false)
  })

  it('无递交日 → 从建档日(created_at)起算', () => {
    const noLodge = mkCase({ created_at: '2026-01-01T00:00:00Z' })
    expect(shouldShowCohabReminder(noLodge, [], TODAY)).toBe(true) // 1/1 建档 → 148 天
    const fresh = mkCase({ created_at: '2026-05-01T00:00:00Z' })
    expect(shouldShowCohabReminder(fresh, [], TODAY)).toBe(false) // 28 天
  })

  it('186 案件用最近一次递交日（提名后又递签证 → 取签证递交日）', () => {
    const c = mkCase({ visa_subclass: '186' })
    const h = [
      mkHist('c1', 'nomination_lodged', '2025-11-01T00:00:00Z'),
      mkHist('c1', 'visa_lodged', '2026-04-01T00:00:00Z'), // 58 天 → 未到点
    ]
    expect(shouldShowCohabReminder(c, h, TODAY)).toBe(false)
  })
})

describe('monthsSinceCohabAnchor / selectCohabReminders（概览条用）', () => {
  it('距锚点月数（/30 近似）', () => {
    expect(monthsSinceCohabAnchor(mkCase({}), lodgedJan, TODAY)).toBe(4) // 148/30
  })

  it('汇总所有到点案件，按月数降序；未到点/未勾选/终态不入列', () => {
    const due = mkCase({ id: 'c1', case_number: 'A1', customer_id: 'cu1' })
    const newer = mkCase({ id: 'c2', case_number: 'A2', customer_id: 'cu2', cohab_reminder_last: '2026-02-01' }) // 117 天 → 3 个月
    const off = mkCase({ id: 'c3', customer_id: 'cu3', cohab_reminder_enabled: false })
    const hist = [
      mkHist('c1', 'visa_lodged', '2025-10-01T00:00:00Z'), // 240 天 → 8 个月
      mkHist('c2', 'visa_lodged', '2025-10-01T00:00:00Z'),
      mkHist('c3', 'visa_lodged', '2025-10-01T00:00:00Z'),
    ]
    const customerById = { cu1: { full_name: '甲' }, cu2: { full_name: '乙' }, cu3: { full_name: '丙' } }
    const items = selectCohabReminders([due, newer, off], hist, customerById, TODAY)
    expect(items.map((i) => i.caseId)).toEqual(['c1', 'c2'])
    expect(items[0]).toMatchObject({ customerId: 'cu1', customerName: '甲', caseNumber: 'A1', monthsSince: 8 })
    expect(items[1].monthsSince).toBe(3)
  })
})
