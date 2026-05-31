import { describe, expect, it } from 'vitest'
import { getLodgementStatus, getLodgementLodgedDate } from './lodgementStatus'
import type { CaseStage, LodgementType } from '../types/domain'
import type { CaseStageHistory } from '../types/models'

const h = (to_stage: CaseStage, effective_at: string): CaseStageHistory => ({
  id: `${to_stage}-${effective_at}`, case_id: 'c1', from_stage: null, to_stage, note: null,
  changed_by: null, changed_at: effective_at, effective_at,
})

describe('getLodgementStatus — 每种 case_stage × 提名/签证', () => {
  const cases: Array<[CaseStage, LodgementType, 'approved' | 'refused' | 'pending']> = [
    ['todo', 'nomination', 'pending'], ['todo', 'visa', 'pending'],
    ['drafted', 'nomination', 'pending'], ['drafted', 'visa', 'pending'],
    ['nomination_lodged', 'nomination', 'pending'], ['nomination_lodged', 'visa', 'pending'],
    ['nomination_approved', 'nomination', 'approved'], ['nomination_approved', 'visa', 'pending'],
    ['visa_lodged', 'nomination', 'approved'], ['visa_lodged', 'visa', 'pending'],
    ['docs_requested', 'nomination', 'approved'], ['docs_requested', 'visa', 'pending'],
    ['docs_completed', 'nomination', 'approved'], ['docs_completed', 'visa', 'pending'],
    ['granted', 'nomination', 'approved'], ['granted', 'visa', 'approved'],
    // 旧数据兼容：additional_docs 视为提名已批、签证待决
    ['additional_docs', 'nomination', 'approved'], ['additional_docs', 'visa', 'pending'],
  ]
  it.each(cases)('%s + %s → %s', (stage, type, expected) => {
    expect(getLodgementStatus(stage, type, [])).toBe(expected)
  })
})

describe('getLodgementStatus — 拒签按历史最近一次涉及的 lodgement 类型', () => {
  it('最近是签证递交 → 签证已拒、提名待决', () => {
    const hist = [h('nomination_lodged', '2026-01-01T00:00:00Z'), h('visa_lodged', '2026-02-01T00:00:00Z')]
    expect(getLodgementStatus('refused', 'visa', hist)).toBe('refused')
    expect(getLodgementStatus('refused', 'nomination', hist)).toBe('pending')
  })
  it('最近只到提名 → 提名已拒、签证待决', () => {
    const hist = [h('nomination_lodged', '2026-01-01T00:00:00Z')]
    expect(getLodgementStatus('refused', 'nomination', hist)).toBe('refused')
    expect(getLodgementStatus('refused', 'visa', hist)).toBe('pending')
  })
  it('无相关历史 → 默认签证已拒', () => {
    expect(getLodgementStatus('refused', 'visa', [])).toBe('refused')
    expect(getLodgementStatus('refused', 'nomination', [])).toBe('pending')
  })
})

describe('getLodgementLodgedDate — 递交日期从 stage_history 派生', () => {
  it('提名/签证各取对应「递交」阶段最近一条的 effective_at 日期', () => {
    const hist = [h('nomination_lodged', '2026-01-05T03:00:00Z'), h('visa_lodged', '2026-03-01T00:00:00Z')]
    expect(getLodgementLodgedDate(hist, 'nomination')).toBe('2026-01-05')
    expect(getLodgementLodgedDate(hist, 'visa')).toBe('2026-03-01')
  })
  it('没有对应历史 → null', () => {
    expect(getLodgementLodgedDate([h('todo', '2026-01-01T00:00:00Z')], 'nomination')).toBeNull()
    expect(getLodgementLodgedDate([], 'visa')).toBeNull()
  })
  it('多条「提名递交」取最近（effective_at 最大）', () => {
    const hist = [
      h('nomination_lodged', '2026-01-01T00:00:00Z'),
      h('nomination_lodged', '2026-02-20T00:00:00Z'),
      h('nomination_lodged', '2026-01-15T00:00:00Z'),
    ]
    expect(getLodgementLodgedDate(hist, 'nomination')).toBe('2026-02-20')
  })
  it('用户改/删历史条目后随输入正确更新', () => {
    expect(getLodgementLodgedDate([h('visa_lodged', '2026-03-01T00:00:00Z')], 'visa')).toBe('2026-03-01')
    // 改实际发生日 → 取新值
    expect(getLodgementLodgedDate([h('visa_lodged', '2026-03-10T00:00:00Z')], 'visa')).toBe('2026-03-10')
    // 删除该条 → null
    expect(getLodgementLodgedDate([], 'visa')).toBeNull()
  })
})
