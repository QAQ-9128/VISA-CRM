import { describe, expect, it } from 'vitest'
import { selectStagePath } from './stagePath'
import type { CaseStageHistory } from '../types/models'

// effective_at 在类型上为 string，但运行期可能为空（代码各处均 ?? changed_at 兜底）→ 测试放宽为可空
const h = (o: Partial<{ [K in keyof CaseStageHistory]: CaseStageHistory[K] | null }>): CaseStageHistory =>
  ({
    id: 'h1', case_id: 'ca1', from_stage: null, to_stage: 'todo', note: null,
    effective_at: null, changed_at: '2026-01-01T00:00:00Z', changed_by: null,
    ...o,
  }) as unknown as CaseStageHistory

describe('selectStagePath（只画真实走过的链，绝不线性填充）', () => {
  it('无历史 → 仅当前阶段单节点（无日期）', () => {
    expect(selectStagePath([], 'todo')).toEqual([{ stage: 'todo', date: null }])
  })

  it('待办 → 提名递交 → 提名获批：链 = 三节点带真实日期', () => {
    const history = [
      h({ id: 'a', from_stage: 'todo', to_stage: 'nomination_lodged', effective_at: '2026-05-20T10:00:00Z' }),
      h({ id: 'b', from_stage: 'nomination_lodged', to_stage: 'nomination_approved', effective_at: '2026-05-21T10:00:00Z' }),
    ]
    expect(selectStagePath(history, 'nomination_approved')).toEqual([
      { stage: 'todo', date: null },
      { stage: 'nomination_lodged', date: '2026-05-20' },
      { stage: 'nomination_approved', date: '2026-05-21' },
    ])
  })

  it('🔒 非线性：待办直接跳提名获批 → 链上只有这两个，中间阶段不出现', () => {
    const history = [h({ from_stage: 'todo', to_stage: 'nomination_approved', effective_at: '2026-05-20T10:00:00Z' })]
    const path = selectStagePath(history, 'nomination_approved')
    expect(path.map((n) => n.stage)).toEqual(['todo', 'nomination_approved'])
    expect(path.some((n) => n.stage === 'nomination_lodged')).toBe(false)
  })

  it('乱序历史按 effective_at(回退 changed_at) 升序；缺 effective_at 用 changed_at 日期', () => {
    const history = [
      h({ id: 'b', from_stage: 'nomination_lodged', to_stage: 'granted', effective_at: '2026-06-01T00:00:00Z' }),
      h({ id: 'a', from_stage: 'todo', to_stage: 'nomination_lodged', effective_at: null, changed_at: '2026-05-01T08:00:00Z' }),
    ]
    expect(selectStagePath(history, 'granted')).toEqual([
      { stage: 'todo', date: null },
      { stage: 'nomination_lodged', date: '2026-05-01' },
      { stage: 'granted', date: '2026-06-01' },
    ])
  })

  it('回退/分支也如实显示（拒签后再上诉）', () => {
    const history = [
      h({ id: 'a', from_stage: 'visa_lodged', to_stage: 'refused', effective_at: '2026-03-01T00:00:00Z' }),
      h({ id: 'b', from_stage: 'refused', to_stage: 'appeal', effective_at: '2026-04-01T00:00:00Z' }),
    ]
    expect(selectStagePath(history, 'appeal').map((n) => n.stage)).toEqual(['visa_lodged', 'refused', 'appeal'])
  })

  it('首行 from_stage 为空 → 链从首个 to_stage 开始', () => {
    const history = [h({ from_stage: null, to_stage: 'nomination_lodged', effective_at: '2026-05-20T00:00:00Z' })]
    expect(selectStagePath(history, 'nomination_lodged')).toEqual([{ stage: 'nomination_lodged', date: '2026-05-20' }])
  })
})
