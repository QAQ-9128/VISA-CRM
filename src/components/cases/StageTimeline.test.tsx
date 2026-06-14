import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { CaseStageHistory } from '../../types/models'

// 阶段历史 + 改/删 mutation 打桩：只验证展示（日期格式），不触真库
const history: CaseStageHistory[] = [
  {
    id: 'h1', case_id: 'ca1', from_stage: 'todo', to_stage: 'nomination_lodged', note: null,
    changed_by: null, changed_at: '2026-03-29T15:00:00Z', effective_at: '2026-03-29T15:00:00Z',
  } as CaseStageHistory,
]

vi.mock('../../hooks/queries/useCases', () => ({
  useCaseStageHistory: () => ({ isPending: false, data: history }),
  useUpdateStageHistory: () => ({ mutate: vi.fn() }),
  useDeleteStageHistory: () => ({ mutate: vi.fn() }),
}))

import { StageTimeline } from './StageTimeline'

describe('StageTimeline（阶段流转记录）', () => {
  it('B：阶段时间戳只显本地日期 YYYY-MM-DD，不含时分秒（无冒号）', () => {
    render(<StageTimeline caseId="ca1" />)
    // 时间戳按钮文案（📅 前缀）：取日期部分应匹配 YYYY-MM-DD，且整体无 ':'（无 04:32:12 这类精确时间）
    const btn = screen.getByTitle('点击修改实际发生日期')
    const text = btn.textContent ?? ''
    expect(text).not.toContain(':') // 不含时分秒
    expect(text).toMatch(/\b\d{4}-\d{2}-\d{2}\b/) // 形如 2026-03-29
  })
})
