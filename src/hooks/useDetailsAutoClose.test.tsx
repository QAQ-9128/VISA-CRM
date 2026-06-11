import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useDetailsAutoClose } from './useDetailsAutoClose'

function Demo() {
  const ref = useDetailsAutoClose()
  return (
    <div>
      <span>页面空白</span>
      <details ref={ref} data-testid="menu">
        <summary>⋯</summary>
        <div>
          <button type="button">归档</button>
        </div>
      </details>
    </div>
  )
}

const open = () => {
  screen.getByTestId('menu').setAttribute('open', '')
  expect(screen.getByTestId<HTMLDetailsElement>('menu').open).toBe(true)
}

describe('useDetailsAutoClose（⋯ 菜单点空白/Esc 自动收起，免去再点三个点）', () => {
  it('点击弹窗外的空白 → 菜单自动关闭', () => {
    render(<Demo />)
    open()
    fireEvent.mouseDown(screen.getByText('页面空白'))
    expect(screen.getByTestId<HTMLDetailsElement>('menu').open).toBe(false)
  })

  it('按 Esc → 关闭', () => {
    render(<Demo />)
    open()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByTestId<HTMLDetailsElement>('menu').open).toBe(false)
  })

  it('点菜单内部 → 保持打开（不误关）', () => {
    render(<Demo />)
    open()
    fireEvent.mouseDown(screen.getByRole('button', { name: '归档' }))
    expect(screen.getByTestId<HTMLDetailsElement>('menu').open).toBe(true)
  })
})
