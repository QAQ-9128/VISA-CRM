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
