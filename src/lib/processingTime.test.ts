import { describe, expect, it } from 'vitest'
import { selectProcessingRows } from './processingTime'
import type { CaseStageHistory } from '../types/models'

const TODAY = new Date(Date.UTC(2026, 5, 4)) // 2026-06-04

const h = (o: Partial<CaseStageHistory>): CaseStageHistory => ({
  id: 'h1', case_id: 'c1', from_stage: null, to_stage: 'nomination_lodged', note: null,
  changed_by: null, changed_at: '2026-05-01T00:00:00Z', effective_at: '2026-05-01T00:00:00Z', ...o,
})

describe('selectProcessingRows（概要带「审理时长」格：按在审阶段一行或两行）', () => {
  it('只提名递交 → 一行提名（审理中：今天−递交实时，tag 审理中）', () => {
    const history = [h({ to_stage: 'nomination_lodged', effective_at: '2026-05-05T00:00:00Z' })]
    expect(selectProcessingRows('nomination_lodged', history, TODAY)).toEqual([
      {
        flow: 'nomination',
        flowLabel: '提名',
        days: 30, // 5-05 → 6-04
        text: '1 个月 0 天',
        status: 'pending',
        tag: '审理中',
      },
    ])
  })

  it('只签证递交 → 一行签证（审理中实时）', () => {
    const history = [h({ to_stage: 'visa_lodged', effective_at: '2026-06-01T00:00:00Z' })]
    expect(selectProcessingRows('visa_lodged', history, TODAY)).toEqual([
      {
        flow: 'visa',
        flowLabel: '签证',
        days: 3,
        text: '3 天',
        status: 'pending',
        tag: '审理中',
      },
    ])
  })

  it('提名+签证都递交 → 两行都显示（提名在前）', () => {
    const history = [
      h({ id: 'h1', to_stage: 'nomination_lodged', effective_at: '2026-01-01T00:00:00Z' }),
      h({ id: 'h2', to_stage: 'visa_lodged', effective_at: '2026-06-01T00:00:00Z' }),
    ]
    const rows = selectProcessingRows('visa_lodged', history, TODAY)
    expect(rows.map((r) => r.flow)).toEqual(['nomination', 'visa'])
  })

  it('提名已批 + 签证在审 → 提名行定格在获批日（tag 已批），签证行实时（tag 审理中）', () => {
    const history = [
      h({ id: 'h1', to_stage: 'nomination_lodged', effective_at: '2026-01-01T00:00:00Z' }),
      h({ id: 'h2', to_stage: 'nomination_approved', effective_at: '2026-02-01T00:00:00Z' }),
      h({ id: 'h3', to_stage: 'visa_lodged', effective_at: '2026-03-01T00:00:00Z' }),
    ]
    expect(selectProcessingRows('visa_lodged', history, TODAY)).toEqual([
      {
        flow: 'nomination',
        flowLabel: '提名',
        days: 31, // 2026-01-01 → 2026-02-01 获批，定格
        text: '1 个月 1 天',
        status: 'approved',
        tag: '已批',
      },
      {
        flow: 'visa',
        flowLabel: '签证',
        days: 95, // 2026-03-01 → 2026-06-04，实时
        text: '3 个月 5 天',
        status: 'pending',
        tag: '审理中',
      },
    ])
  })

  it('下签 → 签证行定格 = 下签日−递交日，仍一直显示（换更晚的「今天」结果不变）', () => {
    const history = [
      h({ id: 'h1', to_stage: 'visa_lodged', effective_at: '2026-01-01T00:00:00Z' }),
      h({ id: 'h2', to_stage: 'granted', effective_at: '2026-03-01T00:00:00Z' }),
    ]
    const expected = [
      {
        flow: 'visa',
        flowLabel: '签证',
        days: 59, // 2026-01-01 → 2026-03-01
        text: '1 个月 29 天',
        status: 'approved',
        tag: '已批',
      },
    ]
    expect(selectProcessingRows('granted', history, TODAY)).toEqual(expected)
    expect(selectProcessingRows('granted', history, new Date(Date.UTC(2026, 11, 31)))).toEqual(expected)
  })

  it('拒签 → 时长冻结到决定日，tag 已拒（被拒的那个流程）', () => {
    const history = [
      h({ id: 'h1', to_stage: 'visa_lodged', effective_at: '2026-01-01T00:00:00Z' }),
      h({ id: 'h2', to_stage: 'refused', effective_at: '2026-03-01T00:00:00Z' }),
    ]
    expect(selectProcessingRows('refused', history, TODAY)).toEqual([
      {
        flow: 'visa',
        flowLabel: '签证',
        days: 59,
        text: '1 个月 29 天',
        status: 'refused',
        tag: '已拒',
      },
    ])
  })

  it('提名/签证都未递交 → 空数组（整格显示 —），不编造日期', () => {
    expect(selectProcessingRows('todo', [], TODAY)).toEqual([])
    expect(selectProcessingRows('drafted', [h({ to_stage: 'drafted' })], TODAY)).toEqual([])
  })
})
