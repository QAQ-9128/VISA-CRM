import { describe, expect, it } from 'vitest'
import {
  deriveCurrentStage,
  isLatestStageHistory,
  latestStageHistory,
  recomputeStageAfterDelete,
  replaceDateKeepTime,
} from './stageHistory'
import type { CaseStage } from '../types/domain'
import type { CaseStageHistory } from '../types/models'

describe('replaceDateKeepTime', () => {
  it('换日期、保留原时分秒(及时区后缀)', () => {
    expect(replaceDateKeepTime('2026-05-29T20:20:55.000Z', '2026-05-20')).toBe('2026-05-20T20:20:55.000Z')
    expect(replaceDateKeepTime('2026-01-01T08:30:00+10:00', '2025-12-31')).toBe('2025-12-31T08:30:00+10:00')
  })
  it('原值无时间部分 → 用 00:00:00', () => {
    expect(replaceDateKeepTime('2026-05-29', '2026-05-20')).toBe('2026-05-20T00:00:00')
  })
})

// ── 阶段流转 → 当前阶段「单一来源派生」（删一条 → 当前阶段回退一步） ──
let seq = 0
function h(over: Partial<CaseStageHistory> & { from: CaseStage | null; to: CaseStage; eff: string }): CaseStageHistory {
  seq += 1
  return {
    id: over.id ?? `h${seq}`,
    case_id: over.case_id ?? 'ca1',
    from_stage: over.from,
    to_stage: over.to,
    note: over.note ?? null,
    changed_by: null,
    changed_at: over.changed_at ?? over.eff,
    effective_at: over.eff,
  } as CaseStageHistory
}

// 顺序：todo → 提名递交 → 提名获批 → 签证递交（按 effective_at 升序构造，乱序传入也应正确取最新）
const lodge = h({ id: 'a', from: 'todo', to: 'nomination_lodged', eff: '2026-01-10T00:00:00Z' })
const nomApproved = h({ id: 'b', from: 'nomination_lodged', to: 'nomination_approved', eff: '2026-03-01T00:00:00Z' })
const visaLodged = h({ id: 'c', from: 'nomination_approved', to: 'visa_lodged', eff: '2026-04-15T00:00:00Z' })
const full = [visaLodged, nomApproved, lodge] // DB 默认 effective_at 倒序

describe('deriveCurrentStage（当前阶段 = 最新一条流转的目标阶段，乱序也对）', () => {
  it('取实际发生时间最晚那条的 to_stage', () => {
    expect(deriveCurrentStage(full)).toBe('visa_lodged')
    expect(deriveCurrentStage([lodge, visaLodged, nomApproved])).toBe('visa_lodged') // 乱序输入
  })
  it('空记录 → null（交调用方兜底初始）', () => {
    expect(deriveCurrentStage([])).toBeNull()
  })
  it('latestStageHistory：effective_at 相同则按 changed_at 兜底取最新', () => {
    const x = h({ id: 'x', from: 'todo', to: 'drafted', eff: '2026-02-02T00:00:00Z', changed_at: '2026-02-02T08:00:00Z' })
    const y = h({ id: 'y', from: 'drafted', to: 'awaiting_payment', eff: '2026-02-02T00:00:00Z', changed_at: '2026-02-02T09:00:00Z' })
    expect(latestStageHistory([x, y])?.id).toBe('y')
  })
})

describe('recomputeStageAfterDelete（删一条后当前阶段回退）', () => {
  it('删最新一条 → 当前阶段回到上一个（剩余里最新一条的 to_stage）', () => {
    const remaining = full.filter((r) => r.id !== 'c') // 删「签证递交」
    expect(recomputeStageAfterDelete(remaining, visaLodged)).toBe('nomination_approved')
  })
  it('连续删：再删「提名获批」→ 回到「提名递交」', () => {
    const remaining = [lodge] // 只剩首条
    expect(recomputeStageAfterDelete(remaining, nomApproved)).toBe('nomination_lodged')
  })
  it('删到空 → 回到被删那条的来源阶段 from_stage（案件初始）', () => {
    expect(recomputeStageAfterDelete([], lodge)).toBe('todo')
  })
  it('删到空且被删那条 from_stage 为空 → 兜底 todo，不报错', () => {
    const only = h({ id: 'z', from: null, to: 'granted', eff: '2026-05-01T00:00:00Z' })
    expect(recomputeStageAfterDelete([], only)).toBe('todo')
  })
})

describe('isLatestStageHistory（只允许删最新一条 = 回退一步）', () => {
  it('仅最新那条返回 true', () => {
    expect(isLatestStageHistory(full, 'c')).toBe(true)
    expect(isLatestStageHistory(full, 'b')).toBe(false)
    expect(isLatestStageHistory(full, 'a')).toBe(false)
  })
})
