import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../../providers/auth-context'
import type { AuthContextValue } from '../../providers/auth-context'
import { CustomerForm } from './CustomerForm'

const authValue = {
  user: { id: 'u1' },
  loading: false,
  session: null,
  profile: null,
  isAdmin: true,
  signIn: async () => {},
  signOut: async () => {},
} as unknown as AuthContextValue

function renderForm(props: Partial<Parameters<typeof CustomerForm>[0]> = {}) {
  const onSubmit = vi.fn()
  const onCancel = vi.fn()
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrap = (children: ReactNode) => (
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter>{children}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  )
  render(wrap(<CustomerForm onSubmit={onSubmit} onCancel={onCancel} {...props} />))
  return { onSubmit, onCancel }
}

describe('CustomerForm（改进版 UI 行为）', () => {
  it('姓名为空 → 无「必填已填写」提示、保存禁用；填写后出现提示、保存可用', () => {
    renderForm()
    expect(screen.queryByText('✓ 必填项已填写')).not.toBeInTheDocument()
    const save = screen.getByRole('button', { name: '保存' })
    expect(save).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/姓名/), { target: { value: '王明' } })
    expect(screen.getByText('✓ 必填项已填写')).toBeInTheDocument()
    expect(save).not.toBeDisabled()
  })

  it('默认「本人是主申请人」选中，不显示「选择主申」下拉', () => {
    renderForm()
    expect(screen.getByLabelText(/本人是主申请人/)).toBeChecked()
    expect(screen.queryByText('选择要挂靠的主申请人')).not.toBeInTheDocument()
  })

  it('选「作为副申请人」→ 出现「选择主申」下拉 + 关系字段；切回主申 → 隐藏', () => {
    renderForm()
    fireEvent.click(screen.getByLabelText(/作为副申请人/))
    expect(screen.getByText('选择要挂靠的主申请人')).toBeInTheDocument()
    expect(screen.getByText('与主申请人关系')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText(/本人是主申请人/))
    expect(screen.queryByText('选择要挂靠的主申请人')).not.toBeInTheDocument()
  })

  it('填姓名 + 保存 → onSubmit 收到含 full_name 的 values', () => {
    const { onSubmit } = renderForm()
    fireEvent.change(screen.getByLabelText(/姓名/), { target: { value: '李雷' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ full_name: '李雷' })
  })

  it('Esc → onCancel；点取消 → onCancel', () => {
    const { onCancel } = renderForm()
    fireEvent.keyDown(screen.getByLabelText(/姓名/), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(onCancel).toHaveBeenCalledTimes(2)
  })
})
