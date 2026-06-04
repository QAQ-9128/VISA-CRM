import { describe, expect, it } from 'vitest'
import { parentCaseDropdown, parentCaseOptionLabel, selectParentCaseCandidates } from './parentCase'
import type { Case, CaseApplicant } from '../types/models'

const mkCase = (o: Partial<Case>): Case => ({
  id: 'c1', case_number: '00000001', customer_id: 'A', visa_subclass: '482', visa_stream: null,
  current_stage: 'todo', currency: 'AUD', sync_tracking: false, trt_reminder_enabled: false,
  parent_case_id: null, parent_sync_progress: false, destination_country: null,
  sponsor_position: null, sponsor_employer_id: null, assigned_to: null, created_by: null,
  is_archived: false, created_at: '2026-01-01', updated_at: '', ...o,
})
const ap = (case_id: string, customer_id: string): CaseApplicant =>
  ({ id: `${case_id}-${customer_id}`, case_id, customer_id, created_at: '' }) as CaseApplicant

describe('selectParentCaseCandidates（一案一组：候选 = 该客户拥有 ∪ 参与的其它案件）', () => {
  const cases = [
    mkCase({ id: 'own1', customer_id: 'A', created_at: '2026-01-01' }), // A 拥有
    mkCase({ id: 'own2', customer_id: 'A', created_at: '2026-03-01' }), // A 拥有（更新）
    mkCase({ id: 'part1', customer_id: 'B', created_at: '2026-02-01' }), // A 参与（B 拥有）
    mkCase({ id: 'other', customer_id: 'C', created_at: '2026-04-01' }), // 无关
    mkCase({ id: 'arch', customer_id: 'A', is_archived: true }), // 已归档
  ]
  const applicants = [ap('part1', 'A')]

  it('候选 = 拥有 ∪ 参与，排除归档与无关案件，按创建时间倒序', () => {
    const out = selectParentCaseCandidates(cases, 'A', applicants)
    expect(out.map((c) => c.id)).toEqual(['own2', 'part1', 'own1'])
  })

  it('编辑中的案件本身被排除', () => {
    const out = selectParentCaseCandidates(cases, 'A', applicants, 'own2')
    expect(out.map((c) => c.id)).toEqual(['part1', 'own1'])
  })

  it('不再有客户关联传递：C 只有自己的案件（A/B 的案不出现）', () => {
    const out = selectParentCaseCandidates(cases, 'C', applicants)
    expect(out.map((c) => c.id)).toEqual(['other'])
  })

  it('无任何案件 → no-cases；有 → has-cases', () => {
    expect(parentCaseDropdown(cases, 'D', applicants).state).toBe('no-cases')
    expect(parentCaseDropdown(cases, 'A', applicants).state).toBe('has-cases')
  })
})

describe('parentCaseOptionLabel', () => {
  it('客户名 · 签证 · 案件编号 · 阶段', () => {
    const c = mkCase({ id: 'x', case_number: '12345678', visa_subclass: '482', visa_stream: 'Core Skills', current_stage: 'todo' })
    expect(parentCaseOptionLabel(c, '王芳')).toBe('王芳 · 482/Core Skills · 12345678 · 待办')
  })
})