import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useConfirm } from './useConfirm'

/** 测试用宿主：点「删除」→ confirm()，结果写到屏幕上。 */
function Harness() {
  const { confirm, confirmNode } = useConfirm()
  return (
    <div>
      <button
        type="button"
        onClick={async () => {
          const ok = await confirm({ title: '删除', description: '确定？', confirmLabel: '删除', tone: 'danger' })
          document.getElementById('out')!.textContent = ok ? 'confirmed' : 'cancelled'
        }}
      >
        触发
      </button>
      <span id="out" />
      {confirmNode}
    </div>
  )
}

describe('useConfirm（Promise 版确认弹窗）', () => {
  it('确认 → resolve(true)', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: '触发' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('确定？')
    fireEvent.click(screen.getByRole('button', { name: '删除' }))
    await waitFor(() => expect(document.getElementById('out')).toHaveTextContent('confirmed'))
    // 关闭后弹窗消失
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('取消 → resolve(false)', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: '触发' }))
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    await waitFor(() => expect(document.getElementById('out')).toHaveTextContent('cancelled'))
  })

  it('Esc → resolve(false)', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: '触发' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(document.getElementById('out')).toHaveTextContent('cancelled'))
  })
})
