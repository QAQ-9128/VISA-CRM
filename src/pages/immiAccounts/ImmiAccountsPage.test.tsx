import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ImmiAccountsPage } from './ImmiAccountsPage'
import { AuthContext } from '../../providers/auth-context'
import type { AuthContextValue } from '../../providers/auth-context'
import type { ImmiAccount } from '../../types/models'

const accs: ImmiAccount[] = [
  { id: 'a1', name: 'IMMI 账号 A', is_archived: false, created_by: null, created_at: '', updated_at: '' },
  { id: 'a2', name: 'IMMI 账号 B', is_archived: false, created_by: null, created_at: '', updated_at: '' },
]

const { listMock, createMock, deleteMock, countMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  createMock: vi.fn(),
  deleteMock: vi.fn(),
  countMock: vi.fn(),
}))
vi.mock('../../api/immiAccounts', () => ({
  listImmiAccounts: (...a: unknown[]) => listMock(...a),
  createImmiAccount: (...a: unknown[]) => createMock(...a),
  deleteImmiAccount: (...a: unknown[]) => deleteMock(...a),
  countCasesUsingImmiAccount: (...a: unknown[]) => countMock(...a),
  getImmiAccount: vi.fn(),
}))

const authValue = {
  user: { id: 'u1' }, loading: false, session: null, profile: null, isAdmin: true,
  signIn: async () => {}, signOut: async () => {},
} as unknown as AuthContextValue

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter>
          <ImmiAccountsPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  listMock.mockResolvedValue(accs)
  createMock.mockResolvedValue({ id: 'a3', name: 'IMMI 账号 C' })
  deleteMock.mockResolvedValue(undefined)
  countMock.mockResolvedValue(0)
})

describe('ImmiAccountsPage（所属账号管理：增 + 删）', () => {
  it('列出全部账号', async () => {
    renderPage()
    expect(await screen.findByText('IMMI 账号 A')).toBeInTheDocument()
    expect(screen.getByText('IMMI 账号 B')).toBeInTheDocument()
  })

  it('新建账号 → createImmiAccount 被调用', async () => {
    renderPage()
    await screen.findByText('IMMI 账号 A')
    fireEvent.click(screen.getByRole('button', { name: /新建账号/ }))
    fireEvent.change(screen.getByLabelText(/账号名称/), { target: { value: 'IMMI 账号 C' } })
    fireEvent.click(screen.getByRole('button', { name: '创建' }))
    await waitFor(() =>
      expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ name: 'IMMI 账号 C' })),
    )
  })

  it('删除未被使用的账号 → 确认弹窗 → deleteImmiAccount 被调用', async () => {
    countMock.mockResolvedValue(0)
    renderPage()
    await screen.findByText('IMMI 账号 A')
    fireEvent.click(screen.getAllByRole('button', { name: '删除' })[0])
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: '删除' }))
    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith('a1'))
  })

  it('删除被 N 个案件引用的账号：弹窗提示「N 个案件」+「未指定」，确认后删除；取消则不变', async () => {
    countMock.mockResolvedValue(2)
    renderPage()
    await screen.findByText('IMMI 账号 A')
    // 取消：不删除
    fireEvent.click(screen.getAllByRole('button', { name: '删除' })[0])
    let dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('2 个案件')
    expect(dialog).toHaveTextContent('未指定')
    fireEvent.click(within(dialog).getByRole('button', { name: '取消' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(deleteMock).not.toHaveBeenCalled()
    // 确认：删除
    fireEvent.click(screen.getAllByRole('button', { name: '删除' })[0])
    dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: '删除' }))
    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith('a1'))
  })
})
