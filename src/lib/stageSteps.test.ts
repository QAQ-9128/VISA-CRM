import { describe, expect, it } from 'vitest'
import { stageSteps } from './stageSteps'
import { CASE_STAGES } from '../types/domain'
import type { CaseStage } from '../types/domain'

describe('stageSteps（全 enum 步进，不写死）', () => {
  it('阶段数 = enum 长度（11），顺序一致', () => {
    const steps = stageSteps('todo')
    expect(steps.length).toBe(CASE_STAGES.length)
    expect(steps.map((s) => s.stage)).toEqual([...CASE_STAGES])
  })

  it('首阶段 todo：自身 current，其余全 future', () => {
    const steps = stageSteps('todo')
    expect(steps[0].state).toBe('current')
    expect(steps.slice(1).every((s) => s.state === 'future')).toBe(true)
  })

  it('中段 visa_lodged：之前 past、自身 current、之后 future', () => {
    const ci = CASE_STAGES.indexOf('visa_lodged')
    const steps = stageSteps('visa_lodged')
    expect(steps[ci].state).toBe('current')
    expect(steps.slice(0, ci).every((s) => s.state === 'past')).toBe(true)
    expect(steps.slice(ci + 1).every((s) => s.state === 'future')).toBe(true)
    // 恰好一个 current
    expect(steps.filter((s) => s.state === 'current')).toHaveLength(1)
  })

  it('拒签/主动撤签标记 abnormal；其余不标', () => {
    const steps = stageSteps('granted')
    const get = (k: CaseStage) => steps.find((s) => s.stage === k)!
    expect(get('refused').abnormal).toBe(true)
    expect(get('withdrawn').abnormal).toBe(true)
    expect(get('docs_requested').abnormal).toBe(false)
    expect(get('granted').abnormal).toBe(false)
  })

  it('当前=拒签：自身 current 且 abnormal', () => {
    const r = stageSteps('refused').find((s) => s.stage === 'refused')!
    expect(r.state).toBe('current')
    expect(r.abnormal).toBe(true)
  })

  it('旧值 additional_docs（不在 enum）：不崩，全部 future、无 current', () => {
    const steps = stageSteps('additional_docs' as CaseStage)
    expect(steps.length).toBe(CASE_STAGES.length)
    expect(steps.some((s) => s.state === 'current')).toBe(false)
    expect(steps.every((s) => s.state === 'future')).toBe(true)
  })
})
