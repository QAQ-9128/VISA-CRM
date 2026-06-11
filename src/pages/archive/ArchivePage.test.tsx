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

describe('ArchivePage · 回收站对全员可见（恢复是 staff 的撤销路径；彻底删除由行内按 admin 门禁）', () => {
  it('admin：有「回收站」切换，点击进入回收站视图', () => {
    renderPage()
    const tab = screen.getByRole('button', { name: '回收站' })
    fireEvent.click(tab)
    expect(screen.getByText('回收站内容占位')).toBeInTheDocument()
  })

  it('staff：同样有「回收站」入口（误归档要能自己恢复）', () => {
    authState.isAdmin = false
    renderPage()
    const tab = screen.getByRole('button', { name: '回收站' })
    fireEvent.click(tab)
    expect(screen.getByText('回收站内容占位')).toBeInTheDocument()
  })
})

describe('ArchivePage · 日期筛选禁未来', () => {
  it('起始日期带 max=今天；手输未来日期被钳回今天（文件都是过去上传的，未来起始必空集）', () => {
    renderPage()
    const from = screen.getByLabelText('起始日期') as HTMLInputElement
    expect(from.max).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    fireEvent.change(from, { target: { value: '2999-01-01' } })
    expect(from.value).toBe(from.max) // 钳回今天
    // 正常的过去日期照常生效
    fireEvent.change(from, { target: { value: '2026-01-01' } })
    expect(from.value).toBe('2026-01-01')
  })

  it('结束日期同样带 max=今天；手输未来日期被钳回今天', () => {
    renderPage()
    const to = screen.getByLabelText('结束日期') as HTMLInputElement
    expect(to.max).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    fireEvent.change(to, { target: { value: '2999-01-01' } })
    expect(to.value).toBe(to.max)
  })

  it('起止互锁：起始改到结束之后 → 结束跟上；结束改到起始之前 → 起始降下（不产生静默空集区间）', () => {
    renderPage()
    const from = screen.getByLabelText('起始日期') as HTMLInputElement
    const to = screen.getByLabelText('结束日期') as HTMLInputElement
    // 起始 > 结束 → 结束被带到起始
    fireEvent.change(to, { target: { value: '2026-01-31' } })
    fireEvent.change(from, { target: { value: '2026-03-01' } })
    expect(to.value).toBe('2026-03-01')
    // 结束 < 起始 → 起始被降到结束
    fireEvent.change(to, { target: { value: '2026-02-01' } })
    expect(from.value).toBe('2026-02-01')
  })
})
