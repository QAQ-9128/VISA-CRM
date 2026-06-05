import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthContext } from '../../providers/auth-context'
import type { AuthContextValue } from '../../providers/auth-context'

// 表单依赖的列表查询全部空数据（零网络）
vi.mock('../../api/customers', async (orig) => ({
  ...(await orig<typeof import('../../api/customers')>()),
  listCustomers: vi.fn().mockResolvedValue([]),
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

describe('CustomerFormPage · 新建：快速建档卡片与完整表单同页并存（2026-06 图纸）', () => {
  it('两张卡同时可见可用：快速建档（五字段）+ 完整建档（原表单原样）', () => {
    renderNew()
    // 左卡：快速建档
    expect(screen.getByText('⚡ 快速建档')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '快速建档' })).toBeInTheDocument()
    // 两张卡各有一个归属人下拉（快速卡 + 完整表单关系区）——同时可用
    expect(screen.getAllByText('归属人').length).toBeGreaterThanOrEqual(2)
    // 右卡：完整表单原样（组选择 / 担保信息 / 保存并新建案件 全都在）
    expect(screen.getByText('完整建档')).toBeInTheDocument()
    expect(screen.getByText(/新建独立客户/)).toBeInTheDocument()
    expect(screen.getAllByText(/加入已有案件/).length).toBeGreaterThan(0)
    expect(screen.getByText('担保信息')).toBeInTheDocument()
    expect(screen.getAllByText(/保存并新建案件/).length).toBeGreaterThan(0)
  })
})
