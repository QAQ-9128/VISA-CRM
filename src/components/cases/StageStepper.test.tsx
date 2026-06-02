import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StageStepper } from './StageStepper'
import { CASE_STAGES, CASE_STAGE_LABELS } from '../../types/domain'

describe('StageStepper', () => {
  it('渲染全部真实阶段（数量=enum 长度，不写死）', () => {
    render(<StageStepper current="visa_lodged" />)
    CASE_STAGES.forEach((s) => expect(screen.getByText(CASE_STAGE_LABELS[s])).toBeInTheDocument())
  })

  it('多行换行（grid），不横向滚动', () => {
    const { container } = render(<StageStepper current="todo" />)
    expect(container.querySelector('.grid')).toBeTruthy()
    expect(container.querySelector('.overflow-x-auto')).toBeNull()
  })

  it('当前阶段高亮（brand 粗体）', () => {
    render(<StageStepper current="visa_lodged" />)
    const cur = screen.getByText('签证递交')
    expect(cur.className).toContain('text-brand')
    expect(cur.className).toContain('font-bold')
  })

  it('拒签标红', () => {
    render(<StageStepper current="refused" />)
    expect(screen.getByText('拒签').className).toContain('rose')
  })

  it('旧值边界不崩，仍渲染全部阶段', () => {
    expect(() => render(<StageStepper current={'additional_docs' as never} />)).not.toThrow()
    CASE_STAGES.forEach((s) => expect(screen.getByText(CASE_STAGE_LABELS[s])).toBeInTheDocument())
  })
})
