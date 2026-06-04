import { describe, expect, it } from 'vitest'
import { selectProcessingTime } from './processingTime'
import type { CaseStageHistory } from '../types/models'

const TODAY = new Date(Date.UTC(2026, 5, 4)) // 2026-06-04

const h = (o: Partial<CaseStageHistory>): CaseStageHistory => ({
  id: 'h1', case_id: 'c1', from_stage: null, to_stage: 'nomination_lodged', note: null,
  changed_by: null, changed_at: '2026-05-01T00:00:00Z', effective_at: '2026-05-01T00:00:00Z', ...o,
})

describe('selectProcessingTime（概要带「审理时间」格）', () => {
  it('当前阶段=提名递交 → 提名审理时间 · 已 N 天（N=今天−真实提名递交日）', () => {
    const history = [h({ to_stage: 'nomination_lodged', effective_at: '2026-05-05T00:00:00Z' })]
    expect(selectProcessingTime('nomination_lodged', history, TODAY)).toEqual({
      label: '提名审理时间',
      days: 30, // 5-05 → 6-04
    })
  })

  it('当前阶段=签证递交 → 签证审理时间（取签证递交日，不看提名）', () => {
    const history = [
      h({ id: 'h1', to_stage: 'nomination_lodged', effective_at: '2026-01-01T00:00:00Z' }),
      h({ id: 'h2', to_stage: 'visa_lodged', effective_at: '2026-06-01T00:00:00Z' }),
    ]
    expect(selectProcessingTime('visa_lodged', history, TODAY)).toEqual({
      label: '签证审理时间',
      days: 3,
    })
  })

  it('其它阶段 → null（此格不显示）', () => {
    const history = [h({ to_stage: 'nomination_lodged', effective_at: '2026-05-05T00:00:00Z' })]
    expect(selectProcessingTime('todo', history, TODAY)).toBeNull()
    expect(selectProcessingTime('granted', history, TODAY)).toBeNull()
    expect(selectProcessingTime('docs_requested', history, TODAY)).toBeNull()
  })

  it('阶段匹配但历史里没有对应递交日期 → null（不编造）', () => {
    expect(selectProcessingTime('nomination_lodged', [], TODAY)).toBeNull()
    // 阶段=签证递交但只有提名递交历史 → 同样 null
    const onlyNom = [h({ to_stage: 'nomination_lodged' })]
    expect(selectProcessingTime('visa_lodged', onlyNom, TODAY)).toBeNull()
  })

  it('多条同类递交历史取最近一次（effective_at 最大）；当天递交 = 已 0 天', () => {
    const history = [
      h({ id: 'h1', to_stage: 'visa_lodged', effective_at: '2026-01-01T00:00:00Z' }),
      h({ id: 'h2', to_stage: 'visa_lodged', effective_at: '2026-06-04T00:00:00Z' }),
    ]
    expect(selectProcessingTime('visa_lodged', history, TODAY)).toEqual({
      label: '签证审理时间',
      days: 0,
    })
  })
})
