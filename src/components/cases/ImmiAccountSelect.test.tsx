import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ImmiAccountSelect } from './ImmiAccountSelect'
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

function renderSelect(value = '', onChange = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={authValue}>
        <ImmiAccountSelect value={value} onChange={onChange} />
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
  return { onChange }
}

beforeEach(() => {
  vi.clearAllMocks()
  listMock.mockResolvedValue(accs)
  createMock.mockResolvedValue({ id: 'a3', name: 'IMMI 账号 C' })
  deleteMock.mockResolvedValue(undefined)
  countMock.mockResolvedValue(0)
})

describe('ImmiAccountSelect（案件表单：增 + 删）', () => {
  it('有「+ 新增」与「管理账号」两个入口', async () => {
    renderSelect()
    expect(await screen.findByRole('button', { name: '+ 新增' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '管理账号' })).toBeInTheDocument()
  })

  it('管理 → 删除未被使用的账号：确认弹窗 → deleteImmiAccount 被调用', async () => {
    countMock.mockResolvedValue(0)
    renderSelect()
    fireEvent.click(await screen.findByRole('button', { name: '管理账号' }))
    fireEvent.click(screen.getAllByRole('button', { name: '删除' })[0])
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: '删除' }))
    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith('a1'))
  })

  it('删除被 N 个案件引用的账号：确认弹窗提示「N 个案件」+「未指定」', async () => {
    countMock.mockResolvedValue(3)
    renderSelect()
    fireEvent.click(await screen.findByRole('button', { name: '管理账号' }))
    fireEvent.click(screen.getAllByRole('button', { name: '删除' })[0])
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('3 个案件')
    expect(dialog).toHaveTextContent('未指定')
    fireEvent.click(within(dialog).getByRole('button', { name: '删除' }))
    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith('a1'))
  })

  it('取消则不删除', async () => {
    countMock.mockResolvedValue(2)
    renderSelect()
    fireEvent.click(await screen.findByRole('button', { name: '管理账号' }))
    fireEvent.click(screen.getAllByRole('button', { name: '删除' })[0])
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: '取消' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(deleteMock).not.toHaveBeenCalled()
  })

  it('删除的是当前选中账号 → 清空选择（onChange("")）', async () => {
    const { onChange } = renderSelect('a1')
    fireEvent.click(await screen.findByRole('button', { name: '管理账号' }))
    fireEvent.click(screen.getAllByRole('button', { name: '删除' })[0]) // a1 = 当前选中
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: '删除' }))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(''))
  })
})
