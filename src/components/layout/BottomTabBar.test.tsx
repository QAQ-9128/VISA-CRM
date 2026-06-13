import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { BottomTabBar } from './BottomTabBar'
import { AuthContext } from '../../providers/auth-context'
import type { AuthContextValue } from '../../providers/auth-context'

function authValue(isAdmin: boolean): AuthContextValue {
  return {
    user: { id: 'u1' }, loading: false, session: null, profile: null, isAdmin,
    signIn: async () => {}, signOut: async () => {},
  } as unknown as AuthContextValue
}

function renderBar(isAdmin = false, path = '/') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthContext.Provider value={authValue(isAdmin)}>
        <BottomTabBar />
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}

describe('BottomTabBar（移动端底部导航 · 主项 + 更多溢出）', () => {
  it('底部栏只放 5 个主项 + 「更多」；溢出项默认不在栏内', () => {
    renderBar()
    const nav = screen.getByRole('navigation')
    for (const label of ['概览', '客户列表', '递交进度', '财务', '档案库']) {
      expect(within(nav).getByText(label)).toBeInTheDocument()
    }
    expect(within(nav).getByRole('button', { name: '更多' })).toBeInTheDocument()
    // 溢出项（雇主/介绍人/所属账号）不直接显示在栏里
    expect(within(nav).queryByText('所属账号')).toBeNull()
    expect(within(nav).queryByText('雇主')).toBeNull()
  })

  it('点「更多」→ 展开溢出菜单（雇主/介绍人/所属账号）', () => {
    renderBar()
    expect(screen.queryByText('所属账号')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '更多' }))
    expect(screen.getByText('所属账号')).toBeInTheDocument()
    expect(screen.getByText('雇主')).toBeInTheDocument()
    expect(screen.getByText('介绍人')).toBeInTheDocument()
  })

  it('账号管理仅 admin 在溢出菜单可见；staff 不可见', () => {
    renderBar(false)
    fireEvent.click(screen.getByRole('button', { name: '更多' }))
    expect(screen.queryByText('账号')).toBeNull()
  })

  it('admin：溢出菜单含「账号」', () => {
    renderBar(true)
    fireEvent.click(screen.getByRole('button', { name: '更多' }))
    expect(screen.getByText('账号')).toBeInTheDocument()
  })
})
