import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../hooks/queries/useArchive', () => ({
  useArchiveFiles: () => ({ isPending: false, isError: false, files: [], customers: [] }),
  useDeleteArchiveFile: () => ({ mutate: vi.fn(), isPending: false, variables: undefined }),
}))
vi.mock('./RecycleBin', () => ({ RecycleBin: () => <div>回收站内容占位</div> }))

import { ArchivePage } from './ArchivePage'
import { AuthContext } from '../../providers/auth-context'
import type { AuthContextValue } from '../../providers/auth-context'

const authState = { isAdmin: true }
const authValue = () =>
  ({
    user: { id: 'u1' }, loading: false, session: null, profile: null, isAdmin: authState.isAdmin,
    signIn: async () => {}, signOut: async () => {},
  }) as unknown as AuthContextValue

function renderPage() {
  return render(
    <AuthContext.Provider value={authValue()}>
      <MemoryRouter>
        <ArchivePage />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

beforeEach(() => {
  authState.isAdmin = true
})

describe('ArchivePage · 回收站入口的角色门禁（彻底删除是 admin 专属）', () => {
  it('admin：有「回收站」切换，点击进入回收站视图', () => {
    renderPage()
    const tab = screen.getByRole('button', { name: '回收站' })
    fireEvent.click(tab)
    expect(screen.getByText('回收站内容占位')).toBeInTheDocument()
  })

  it('staff（非 admin）：没有「回收站」入口，文件视图照常可用', () => {
    authState.isAdmin = false
    renderPage()
    expect(screen.queryByRole('button', { name: '回收站' })).toBeNull()
    expect(screen.getByRole('button', { name: '文件' })).toBeInTheDocument()
    expect(screen.getByText('档案库')).toBeInTheDocument()
  })
})
