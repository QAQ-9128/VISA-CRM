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

// 两条记录（DB 默认 effective_at 倒序）：h2 为最新一条 → 只它可删
const history2: CaseStageHistory[] = [
  {
    id: 'h2', case_id: 'ca1', from_stage: 'nomination_lodged', to_stage: 'nomination_approved', note: null,
    changed_by: null, changed_at: '2026-04-10T00:00:00Z', effective_at: '2026-04-10T00:00:00Z',
  } as CaseStageHistory,
  {
    id: 'h1', case_id: 'ca1', from_stage: 'todo', to_stage: 'nomination_lodged', note: null,
    changed_by: null, changed_at: '2026-03-29T15:00:00Z', effective_at: '2026-03-29T15:00:00Z',
  } as CaseStageHistory,
]

const rowsRef: { current: CaseStageHistory[] } = { current: history }

vi.mock('../../hooks/queries/useCases', () => ({
  useCaseStageHistory: () => ({ isPending: false, data: rowsRef.current }),
  useUpdateStageHistory: () => ({ mutate: vi.fn() }),
  useDeleteStageHistory: () => ({ mutate: vi.fn() }),
}))

import { StageTimeline } from './StageTimeline'

describe('StageTimeline（阶段流转记录）', () => {
  it('B：阶段时间戳只显本地日期 YYYY-MM-DD，不含时分秒（无冒号）', () => {
    rowsRef.current = history
    render(<StageTimeline caseId="ca1" />)
    // 时间戳按钮文案（📅 前缀）：取日期部分应匹配 YYYY-MM-DD，且整体无 ':'（无 04:32:12 这类精确时间）
    const btn = screen.getByTitle('点击修改实际发生日期')
    const text = btn.textContent ?? ''
    expect(text).not.toContain(':') // 不含时分秒
    expect(text).toMatch(/\b\d{4}-\d{2}-\d{2}\b/) // 形如 2026-03-29
  })

  it('只允许删最新一条（回退一步）：多条时仅最新那条有删除按钮', () => {
    rowsRef.current = history2
    render(<StageTimeline caseId="ca1" />)
    // 只有最新一条 h2 暴露删除按钮，避免删中间记录把链断开
    const delButtons = screen.getAllByRole('button', { name: '删除最新一条流转（回退一步）' })
    expect(delButtons).toHaveLength(1)
  })

  it('单条时该条即最新 → 可删', () => {
    rowsRef.current = history
    render(<StageTimeline caseId="ca1" />)
    expect(screen.getByRole('button', { name: '删除最新一条流转（回退一步）' })).toBeInTheDocument()
  })
})
