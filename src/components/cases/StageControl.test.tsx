import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// 推进阶段写库 hook 打桩：只验证 UI（备注常驻）与提交载荷，不触真库。
const mutate = vi.fn()
vi.mock('../../hooks/queries/useCases', () => ({
  useUpdateCaseStage: () => ({ mutate, isPending: false, isError: false, error: null }),
}))

import { StageControl } from './StageControl'

const NOTE_LABEL = '备注（可选，记入时间线）'

describe('StageControl（推进阶段 · 备注常驻）', () => {
  beforeEach(() => mutate.mockReset())

  it('备注框常驻：尚未切换阶段时（任意当前阶段）备注选项就已可见', () => {
    render(<StageControl caseId="ca1" currentStage="todo" />)
    expect(screen.getByText(NOTE_LABEL)).toBeInTheDocument()
  })

  it('备注输入框不带示例占位文案（留空显示）', () => {
    render(<StageControl caseId="ca1" currentStage="todo" />)
    const note = screen.getByLabelText(NOTE_LABEL) as HTMLInputElement
    expect(note.placeholder).toBe('')
  })

  it('切到任意目标阶段后备注仍在，并随阶段一起提交进时间线', () => {
    render(<StageControl caseId="ca1" currentStage="todo" />)
    fireEvent.change(screen.getByLabelText('切换到'), { target: { value: 'nomination_lodged' } })
    expect(screen.getByText(NOTE_LABEL)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(NOTE_LABEL), { target: { value: '已递交提名' } })
    fireEvent.click(screen.getByRole('button', { name: '更新阶段' }))
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ caseId: 'ca1', toStage: 'nomination_lodged', note: '已递交提名' }),
      expect.anything(),
    )
  })

  it('未切换阶段时「更新阶段」按钮禁用（备注可见但不可空提交）', () => {
    render(<StageControl caseId="ca1" currentStage="todo" />)
    expect(screen.getByRole('button', { name: '更新阶段' })).toBeDisabled()
  })
})

describe('StageControl · 职业评估专属阶段（FancySelect · 7 个英文阶段 · 禁未来）', () => {
  beforeEach(() => mutate.mockReset())

  it('职业评估：切换到 = FancySelect，展开恰好列出 7 个英文阶段（当前在集合内不前置）', () => {
    render(<StageControl caseId="ca1" currentStage="oa_skill_submitted" caseCategory="职业评估" />)
    fireEvent.click(screen.getByRole('button', { name: '切换到' }))
    expect(screen.getAllByRole('option')).toHaveLength(7)
    expect(screen.getByRole('option', { name: 'CHN Qualifications Verification Submitted' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Skill Assessment Submitted' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Request further evidence' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Responded' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Approved' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Positive Outcome' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Negative Outcome' })).toBeInTheDocument()
  })

  it('职业评估未推进（current=todo）：当前阶段显示「无」（不显待办徽章）；下拉仍恰好 7 个 OA 阶段、无待办选项', () => {
    render(<StageControl caseId="ca1" currentStage="todo" caseCategory="职业评估" />)
    // 当前阶段显示「无」，不出现「待办」
    expect(screen.getByText('无')).toBeInTheDocument()
    expect(screen.queryByText('待办')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '切换到' }))
    const opts = screen.getAllByRole('option')
    expect(opts).toHaveLength(7) // 不前置 todo → 恰好 7
    expect(opts.map((o) => o.textContent)).not.toContain('待办')
  })

  it('职业评估已推进（current=oa_approved）：当前阶段显示英文 Approved（非「无」）', () => {
    render(<StageControl caseId="ca1" currentStage="oa_approved" caseCategory="职业评估" />)
    // 当前阶段徽章 + FancySelect 触发器都显示 Approved（≥1 处），且不再显示「无」
    expect(screen.getAllByText('Approved').length).toBeGreaterThan(0)
    expect(screen.queryByText('无')).toBeNull()
  })

  it('职业评估推进：选目标阶段 + 备注 → mutate 收到 OA stage key（from→to + note）', () => {
    render(<StageControl caseId="ca1" currentStage="oa_skill_submitted" caseCategory="职业评估" />)
    fireEvent.click(screen.getByRole('button', { name: '切换到' }))
    fireEvent.click(screen.getByRole('option', { name: 'Positive Outcome' }))
    fireEvent.change(screen.getByLabelText(NOTE_LABEL), { target: { value: '评估通过' } })
    fireEvent.click(screen.getByRole('button', { name: '更新阶段' }))
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ caseId: 'ca1', fromStage: 'oa_skill_submitted', toStage: 'oa_positive', note: '评估通过' }),
      expect.anything(),
    )
  })

  it('职业评估首次推进（从未推进 todo）：from_stage 写 null → 流转记录直接显目标阶段（不出现「待办 →」）', () => {
    render(<StageControl caseId="ca1" currentStage="todo" caseCategory="职业评估" />)
    fireEvent.click(screen.getByRole('button', { name: '切换到' }))
    fireEvent.click(screen.getByRole('option', { name: 'Skill Assessment Submitted' }))
    fireEvent.click(screen.getByRole('button', { name: '更新阶段' }))
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ caseId: 'ca1', fromStage: null, toStage: 'oa_skill_submitted' }),
      expect.anything(),
    )
  })

  it('实际发生日期不能选未来：设未来日期 → 校验拦截、不写库', () => {
    render(<StageControl caseId="ca1" currentStage="oa_skill_submitted" caseCategory="职业评估" />)
    fireEvent.click(screen.getByRole('button', { name: '切换到' }))
    fireEvent.click(screen.getByRole('option', { name: 'Approved' }))
    fireEvent.change(screen.getByLabelText(/实际发生日期/), { target: { value: '2999-12-31' } })
    fireEvent.click(screen.getByRole('button', { name: '更新阶段' }))
    expect(mutate).not.toHaveBeenCalled()
  })
})
