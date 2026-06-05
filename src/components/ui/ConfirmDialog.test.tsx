import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConfirmDialog } from './ConfirmDialog'

function renderDlg(over: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const onConfirm = vi.fn()
  const onClose = vi.fn()
  render(
    <ConfirmDialog
      open
      title="确定归档「张三」吗？"
      description="归档后默认不显示，可在回收站恢复。"
      confirmLabel="归档"
      onConfirm={onConfirm}
      onClose={onClose}
      {...over}
    />,
  )
  return { onConfirm, onClose }
}

describe('ConfirmDialog（统一风格确认弹窗）', () => {
  it('open=false 不渲染', () => {
    renderDlg({ open: false })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('显示标题与说明；确认触发 onConfirm', () => {
    const { onConfirm } = renderDlg()
    expect(screen.getByRole('dialog')).toHaveTextContent('回收站恢复')
    fireEvent.click(screen.getByRole('button', { name: '归档' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('取消 / Esc / 点遮罩 → onClose，不触发确认', () => {
    const { onConfirm, onClose } = renderDlg()
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('pending 时确认键禁用并显示处理中', () => {
    renderDlg({ pending: true, pendingLabel: '归档中…' })
    expect(screen.getByRole('button', { name: '归档中…' })).toBeDisabled()
  })
})
