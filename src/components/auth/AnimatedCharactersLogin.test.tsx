import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../../providers/auth-context'
import type { AuthContextValue } from '../../providers/auth-context'

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }))
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigateMock,
}))

import { AnimatedCharactersLogin } from './AnimatedCharactersLogin'

const signInMock = vi.fn()

function makeAuth(): AuthContextValue {
  return {
    user: null,
    loading: false,
    session: null,
    profile: null,
    isAdmin: false,
    signIn: signInMock,
    signOut: async () => {},
  } as unknown as AuthContextValue
}

function renderLogin() {
  return render(
    <AuthContext.Provider value={makeAuth()}>
      <MemoryRouter initialEntries={['/login']}>
        <AnimatedCharactersLogin />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

beforeEach(() => {
  signInMock.mockReset()
  navigateMock.mockReset()
})

describe('AnimatedCharactersLogin（接真实 Supabase 登录）', () => {
  it('成功登录：用裁剪后的邮箱+密码+记住我调用 signIn，并跳转目标页', async () => {
    signInMock.mockResolvedValueOnce(undefined)
    renderLogin()

    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: '  a@b.com  ' } })
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByRole('button', { name: '登录' }))

    await waitFor(() => expect(signInMock).toHaveBeenCalledTimes(1))
    expect(signInMock).toHaveBeenCalledWith({ email: 'a@b.com', password: 'secret123', remember: true })
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/', { replace: true }))
  })

  it('记住我可取消：未勾选时 remember=false', async () => {
    signInMock.mockResolvedValueOnce(undefined)
    renderLogin()

    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'pw' } })
    fireEvent.click(screen.getByLabelText('记住我（约 30 天）'))
    fireEvent.click(screen.getByRole('button', { name: '登录' }))

    await waitFor(() => expect(signInMock).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pw', remember: false }))
  })

  it('登录失败：凭据错误映射为中文提示，不跳转', async () => {
    signInMock.mockRejectedValueOnce(new Error('Invalid login credentials'))
    renderLogin()

    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: '登录' }))

    expect(await screen.findByText('邮箱或密码不正确')).toBeInTheDocument()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('忘记密码：提示联系管理员（不发起登录）', () => {
    renderLogin()
    fireEvent.click(screen.getByRole('button', { name: '忘记密码？' }))
    expect(screen.getByText(/账号与密码由管理员分配/)).toBeInTheDocument()
    expect(signInMock).not.toHaveBeenCalled()
  })
})
