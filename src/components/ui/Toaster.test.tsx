import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Toaster } from './Toaster'
import { useUiStore, toastSuccess, toastError } from '../../store/ui'

beforeEach(() => useUiStore.setState({ toasts: [] }))

describe('Toaster', () => {
  it('无 toast 时不渲染任何条目', () => {
    const { container } = render(<Toaster />)
    expect(container.querySelectorAll('[role]').length).toBe(0)
  })

  it('成功 = role=status 绿条；错误 = role=alert 红条', () => {
    render(<Toaster />)
    act(() => {
      toastSuccess('已保存')
      toastError('保存失败：RLS')
    })
    expect(screen.getByRole('status')).toHaveTextContent('已保存')
    expect(screen.getByRole('alert')).toHaveTextContent('保存失败：RLS')
  })

  it('点 toast 即关闭', () => {
    render(<Toaster />)
    act(() => toastSuccess('已保存'))
    fireEvent.click(screen.getByRole('status'))
    expect(useUiStore.getState().toasts).toHaveLength(0)
  })
})
