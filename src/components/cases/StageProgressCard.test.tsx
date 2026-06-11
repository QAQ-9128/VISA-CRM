import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// 子组件打桩：用可识别文案代替，避免真连库/真起 query。
vi.mock('./StageControl', () => ({
  StageControl: () => <div>__STAGE_CONTROL__</div>,
}))
vi.mock('./StageTimeline', () => ({
  StageTimeline: () => <div>__STAGE_TIMELINE__</div>,
}))

// 阶段历史 hook：给一条真实走过链（待办→提名递交→提名获批），
// 删除前这会渲染出横向阶段流程 chip；删除后不该再出现。
vi.mock('../../hooks/queries/useCases', () => ({
  useCaseStageHistory: () => ({
    data: [
      { id: 'h1', case_id: 'ca1', from_stage: null, to_stage: 'todo', effective_at: '2026-01-01T00:00:00Z', created_at: '2026-01-01T00:00:00Z', note: null },
      { id: 'h2', case_id: 'ca1', from_stage: 'todo', to_stage: 'nomination_lodged', effective_at: '2026-02-01T00:00:00Z', created_at: '2026-02-01T00:00:00Z', note: null },
      { id: 'h3', case_id: 'ca1', from_stage: 'nomination_lodged', to_stage: 'nomination_approved', effective_at: '2026-03-01T00:00:00Z', created_at: '2026-03-01T00:00:00Z', note: null },
    ],
  }),
}))

import { StageProgressCard } from './StageProgressCard'
import type { Case } from '../../types/models'

const caseRow = { id: 'ca1', current_stage: 'nomination_approved' } as Case

describe('StageProgressCard（阶段进展区）', () => {
  it('不再渲染顶部横向阶段流程图及其副标', () => {
    render(<StageProgressCard caseRow={caseRow} />)
    // 副标已删
    expect(screen.queryByText('按实际记录，没走的阶段不显示')).not.toBeInTheDocument()
    // 走过的阶段 chip 标签不再展示（仅顶部流程图用到这些文案）
    expect(screen.queryByText('提名递交')).not.toBeInTheDocument()
    expect(screen.queryByText('提名获批')).not.toBeInTheDocument()
    // 「当前 · 日期」高亮文案也不再出现
    expect(screen.queryByText(/^当前/)).not.toBeInTheDocument()
  })

  it('保留区标题、「推进阶段」按钮、「阶段流转记录」', () => {
    render(<StageProgressCard caseRow={caseRow} />)
    expect(screen.getByText('阶段进展')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '推进阶段 →' })).toBeInTheDocument()
    expect(screen.getByText('阶段流转记录')).toBeInTheDocument()
    expect(screen.getByText('__STAGE_TIMELINE__')).toBeInTheDocument()
  })

  it('点「推进阶段」展开 StageControl（推进入口照旧）', () => {
    render(<StageProgressCard caseRow={caseRow} />)
    expect(screen.queryByText('__STAGE_CONTROL__')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '推进阶段 →' }))
    expect(screen.getByText('__STAGE_CONTROL__')).toBeInTheDocument()
  })
})
