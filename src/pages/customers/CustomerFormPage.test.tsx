import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthContext } from '../../providers/auth-context'
import type { AuthContextValue } from '../../providers/auth-context'

const { createCustomerMock, navigateMock } = vi.hoisted(() => ({
  // 依调用顺序发 id：组区先建同组人 cu-b，提交时再建主客户 cu-a
  createCustomerMock: vi.fn(),
  navigateMock: vi.fn(),
}))
vi.mock('../../api/customers', async (orig) => ({
  ...(await orig<typeof import('../../api/customers')>()),
  listCustomers: vi.fn().mockResolvedValue([]),
  createCustomer: createCustomerMock,
}))
vi.mock('../../api/cases', async (orig) => ({
  ...(await orig<typeof import('../../api/cases')>()),
  listCases: vi.fn().mockResolvedValue([]),
}))
vi.mock('../../api/caseApplicants', async (orig) => ({
  ...(await orig<typeof import('../../api/caseApplicants')>()),
  listAllCaseApplicants: vi.fn().mockResolvedValue([]),
}))
vi.mock('../../api/employers', async (orig) => ({
  ...(await orig<typeof import('../../api/employers')>()),
  listEmployers: vi.fn().mockResolvedValue([]),
}))
vi.mock('../../api/referrers', async (orig) => ({
  ...(await orig<typeof import('../../api/referrers')>()),
  listReferrers: vi.fn().mockResolvedValue([]),
}))
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigateMock,
}))

import { CustomerFormPage } from './CustomerFormPage'

const authValue = {
  user: { id: 'u1' }, loading: false, session: null, profile: null, isAdmin: true,
  signIn: async () => {}, signOut: async () => {},
} as unknown as AuthContextValue

function renderNew() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={['/customers/new']}>
          <Routes>
            <Route path="/customers/new" element={<CustomerFormPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  navigateMock.mockReset()
  createCustomerMock.mockReset()
  let n = 0
  createCustomerMock.mockImplementation(async (input: { full_name: string }) => ({
    id: n++ === 0 ? 'cu-b' : 'cu-a',
    ...input,
  }))
})

describe('CustomerFormPage · 单张完整表单（独立快速卡已删；建同组人在组区内）', () => {
  it('只有一张完整表单：无 ⚡ 快速建档卡；组区有「快速建档同组的人」入口', () => {
    renderNew()
    expect(screen.queryByText('⚡ 快速建档')).toBeNull()
    expect(screen.queryByText('完整建档')).toBeNull() // 单卡无需左右卡标题
    expect(screen.getAllByLabelText(/姓名/)).toHaveLength(1) // 只有一个姓名输入
    expect(screen.getByText('组（Group）')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /快速建档同组的人/ })).toBeInTheDocument()
    expect(screen.queryByText('担保信息')).toBeNull() // 担保雇主/职位已移到案件级（案件表单录入）
  })

  it('组区建同组人 + 保存并新建案件 → 跳 /cases/new 带 ?customer=主客户&with=同组人（自动预选参与人）', async () => {
    renderNew()
    // ① 组区快速建李四（cu-b）
    fireEvent.click(screen.getByRole('button', { name: /快速建档同组的人/ }))
    fireEvent.change(screen.getAllByLabelText(/姓名/)[1], { target: { value: '李四' } })
    fireEvent.click(screen.getByRole('button', { name: /创建并加入名单/ }))
    expect(await screen.findByText('李四')).toBeInTheDocument()
    // ② 主客户张三（cu-a）保存并新建案件
    fireEvent.change(screen.getAllByLabelText(/姓名/)[0], { target: { value: '张三' } })
    fireEvent.click(screen.getByRole('button', { name: '保存并新建案件' }))
    await vi.waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith('/cases/new?customer=cu-a&with=cu-b', { replace: true }),
    )
  })
})
