import { describe, expect, it } from 'vitest'
import { isNominationApproved, isVisaGranted } from './approval'
import type { CaseStage } from '../types/domain'

const h = (to_stage: CaseStage) => ({ to_stage })

describe('isVisaGranted（签证获批 = 下签）', () => {
  it('granted → true', () => {
    expect(isVisaGranted('granted')).toBe(true)
  })
  it('其余阶段 → false（含已过提名获批的中间阶段与拒签）', () => {
    for (const s of ['todo', 'drafted', 'nomination_lodged', 'nomination_approved', 'visa_lodged', 'refused', 'withdrawn'] as const) {
      expect(isVisaGranted(s)).toBe(false)
    }
  })
})

describe('isNominationApproved（提名获批：当前阶段达到/越过提名获批，或历史曾达到）', () => {
  it('当前阶段 = 提名获批及其后续主流程 → true（无需历史）', () => {
    for (const s of ['nomination_approved', 'visa_lodged', 'docs_requested', 'docs_completed', 'granted'] as const) {
      expect(isNominationApproved(s, [])).toBe(true)
    }
  })
  it('当前阶段在提名获批之前 → false', () => {
    for (const s of ['todo', 'drafted', 'nomination_lodged'] as const) {
      expect(isNominationApproved(s, [])).toBe(false)
    }
  })
  it('拒签/撤签案件：靠历史兜底——历史曾到签证递交（提名必已获批）→ true', () => {
    expect(isNominationApproved('refused', [h('nomination_lodged'), h('nomination_approved'), h('visa_lodged'), h('refused')])).toBe(true)
    expect(isNominationApproved('withdrawn', [h('visa_lodged')])).toBe(true)
  })
  it('拒签且历史从未达到提名获批 → false（提名阶段就被拒）', () => {
    expect(isNominationApproved('refused', [h('nomination_lodged'), h('refused')])).toBe(false)
  })
})
