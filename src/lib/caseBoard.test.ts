import { describe, expect, it } from 'vitest'
import { groupCasesByStage } from './caseBoard'
import { CASE_STAGES } from '../types/domain'
import type { Case } from '../types/models'

const mk = (id: string, stage: Case['current_stage']): Case => ({
  id,
  customer_id: 'cu1',
  visa_subclass: '482',
  destination_country: 'Australia',
  current_stage: stage,
  currency: 'AUD',
  assigned_to: null,
  created_by: null,
  is_archived: false,
  created_at: '',
  updated_at: '',
})

describe('groupCasesByStage', () => {
  it('按 CASE_STAGES 顺序返回所有列（含空列）', () => {
    const r = groupCasesByStage([])
    expect(r.map((col) => col.stage)).toEqual([...CASE_STAGES])
    expect(r.every((col) => col.cases.length === 0)).toBe(true)
  })

  it('把案件分到对应阶段', () => {
    const cases = [mk('c1', 'consulting'), mk('c2', 'granted'), mk('c3', 'consulting')]
    const r = groupCasesByStage(cases)
    const consulting = r.find((c) => c.stage === 'consulting')!
    const granted = r.find((c) => c.stage === 'granted')!
    expect(consulting.cases.map((c) => c.id)).toEqual(['c1', 'c3'])
    expect(granted.cases.map((c) => c.id)).toEqual(['c2'])
  })
})
