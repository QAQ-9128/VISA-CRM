import { describe, expect, it } from 'vitest'
import {
  relationshipOf,
  relationshipPatch,
  syncStageAction,
  wouldCreateCycle,
  propagateSyncedStage,
} from './caseRelationship'
import type { Case } from '../types/models'

const mkCase = (o: Partial<Case>): Case => ({
  id: 'c1', case_number: '00000001', customer_id: 'cu1', visa_subclass: '482', visa_stream: null, current_stage: 'todo',
  currency: 'AUD', sync_tracking: true, trt_reminder_enabled: false, parent_case_id: null, parent_sync_progress: false,
  destination_country: 'Australia', assigned_to: null, created_by: null, is_archived: false, created_at: '', updated_at: '', ...o,
})

describe('relationshipOf（存储字段 → 三态）', () => {
  it('无 parent → 独立', () => {
    expect(relationshipOf({ parent_case_id: null, parent_sync_progress: false })).toBe('independent')
  })
  it('有 parent、sync=false → 关联(进度独立)', () => {
    expect(relationshipOf({ parent_case_id: 'p', parent_sync_progress: false })).toBe('linked')
  })
  it('有 parent、sync=true → 关联(进度同步)', () => {
    expect(relationshipOf({ parent_case_id: 'p', parent_sync_progress: true })).toBe('synced')
  })
})

describe('relationshipPatch（三态 → 写库字段；覆盖 G 所有切换的字段结果）', () => {
  it('→ 独立：清空 parent + sync', () => {
    expect(relationshipPatch('independent', 'p')).toEqual({ parent_case_id: null, parent_sync_progress: false })
  })
  it('→ 关联(独立)：parent=选定，sync=false', () => {
    expect(relationshipPatch('linked', 'p')).toEqual({ parent_case_id: 'p', parent_sync_progress: false })
  })
  it('→ 关联(同步)：parent=选定，sync=true', () => {
    expect(relationshipPatch('synced', 'p')).toEqual({ parent_case_id: 'p', parent_sync_progress: true })
  })
  it('关联态但没选主案件 → 退化为独立（防止 sync=true 却无 parent）', () => {
    expect(relationshipPatch('synced', null)).toEqual({ parent_case_id: null, parent_sync_progress: false })
    expect(relationshipPatch('linked', null)).toEqual({ parent_case_id: null, parent_sync_progress: false })
  })
})

describe('syncStageAction（开启同步时立即对齐主案件 stage，并写 history 理由）', () => {
  it('同步态且本案 stage 与主案件不同 → 把本案对齐到主案 stage，理由「进度同步开启」', () => {
    expect(syncStageAction('synced', 'todo', 'visa_lodged')).toEqual({ toStage: 'visa_lodged', note: '进度同步开启' })
  })
  it('同步态但 stage 已一致 → 无需动作', () => {
    expect(syncStageAction('synced', 'granted', 'granted')).toBeNull()
  })
  it('非同步态 → 无需动作（独立/关联独立都不动 stage）', () => {
    expect(syncStageAction('linked', 'todo', 'granted')).toBeNull()
    expect(syncStageAction('independent', 'todo', 'granted')).toBeNull()
  })
})

describe('wouldCreateCycle（关系成环检测：A→B 后 B→A 被拒）', () => {
  // A 关联到 B（A.parent = B）
  const cases = [mkCase({ id: 'A', parent_case_id: 'B' }), mkCase({ id: 'B', parent_case_id: null })]
  it('给 B 选 A 作主案件 → 成环 → true（拒绝）', () => {
    expect(wouldCreateCycle(cases, 'B', 'A')).toBe(true)
  })
  it('自己依附自己 → 成环 → true', () => {
    expect(wouldCreateCycle(cases, 'A', 'A')).toBe(true)
  })
  it('给 A 选别的无关案件 X → 不成环 → false', () => {
    const withX = [...cases, mkCase({ id: 'X' })]
    expect(wouldCreateCycle(withX, 'A', 'X')).toBe(false)
  })
})

describe('propagateSyncedStage（主案件改 stage 的同步规则；触发器逻辑的参考实现）', () => {
  const parentId = 'P'
  const cases = [
    mkCase({ id: 'syncChild', parent_case_id: parentId, parent_sync_progress: true, current_stage: 'todo' }),
    mkCase({ id: 'linkedChild', parent_case_id: parentId, parent_sync_progress: false, current_stage: 'todo' }),
    mkCase({ id: 'unrelated', parent_case_id: null, current_stage: 'todo' }),
    mkCase({ id: 'syncedSame', parent_case_id: parentId, parent_sync_progress: true, current_stage: 'granted' }),
  ]
  it('只有「同步且 stage 不同」的子案件跟变；独立子案件 / 无关案件不变', () => {
    const entries = propagateSyncedStage(cases, parentId, 'granted')
    expect(entries.map((e) => e.caseId)).toEqual(['syncChild'])
    expect(entries[0]).toEqual({ caseId: 'syncChild', fromStage: 'todo', toStage: 'granted' })
  })
})
