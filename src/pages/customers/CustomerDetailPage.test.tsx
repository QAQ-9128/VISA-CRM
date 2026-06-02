import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthContext } from '../../providers/auth-context'
import type { AuthContextValue } from '../../providers/auth-context'
import type { Customer } from '../../types/models'

// mock 客户读取，返回一个主申客户；其余查询在测试中无网络（retry:false）→ 空态
vi.mock('../../api/customers', async (orig) => {
  const actual = await orig<typeof import('../../api/customers')>()
  return {
    ...actual,
    getCustomer: vi.fn().mockResolvedValue({
      id: 'cu1',
      full_name: '测试客户',
      primary_applicant_id: null,
      client_source: null,
      is_starred: false,
      is_archived: false,
      gender: 'male',
      sponsor_employer_id: null,
      sponsor_position: null,
      referrer_id: null,
      birth_date: null,
      notes: null,
      phone: null,
      email: null,
    } as unknown as Customer),
    listCustomers: vi.fn().mockResolvedValue([]),
  }
})

import { CustomerDetailPage } from './CustomerDetailPage'

const authValue = {
  user: { id: 'u1' },
  loading: false,
  session: null,
  profile: null,
  isAdmin: true,
  signIn: async () => {},
  signOut: async () => {},
} as unknown as AuthContextValue

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={['/customers/cu1']}>
          <Routes>
            <Route path="/customers/:id" element={<CustomerDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

describe('CustomerDetailPage（tab 结构）', () => {
  it('头部 + 5 个 tab（家庭成员并入案件）；默认在概览（KPI + 基本信息），编辑客户/收藏在', async () => {
    renderPage()
    expect(await screen.findByText('测试客户')).toBeInTheDocument()
    for (const t of ['概览', '案件 / 家庭成员', '付款', '文件', '记录']) {
      expect(screen.getByRole('button', { name: t })).toBeInTheDocument()
    }
    // 家庭成员不再是独立 tab
    expect(screen.queryByRole('button', { name: '家庭成员' })).not.toBeInTheDocument()
    expect(screen.getByText('编辑客户')).toBeInTheDocument()
    expect(screen.getByText('活跃案件')).toBeInTheDocument() // KPI（概览唯一统计来源）
    expect(screen.getByText('基本信息')).toBeInTheDocument()
    // 概览不渲染完整记录时间线 / 上传区
    expect(screen.queryByText('记录时间线')).not.toBeInTheDocument()
  })

  it('切到「记录」tab → 渲染完整记录功能（快速添加 + 时间线）', async () => {
    renderPage()
    await screen.findByText('测试客户')
    fireEvent.click(screen.getByRole('button', { name: '记录' }))
    expect(await screen.findByText('快速添加记录')).toBeInTheDocument()
    expect(screen.getByText('记录时间线')).toBeInTheDocument()
  })

  it('切到「文件」tab → 渲染完整文件功能（上传 + 待补充 + 文件总数统计卡）', async () => {
    renderPage()
    await screen.findByText('测试客户')
    fireEvent.click(screen.getByRole('button', { name: '文件' }))
    expect(await screen.findByText('选择文件上传')).toBeInTheDocument()
    expect(screen.getByText('待补充 / 缺失提醒')).toBeInTheDocument()
    expect(screen.getByText('文件总数')).toBeInTheDocument() // full 变体统计卡
  })

  it('家庭成员并入「案件 / 家庭成员」tab，且概览也含三个按钮（含关联现有客户，同一套 flow）', async () => {
    renderPage()
    await screen.findByText('测试客户')
    // 概览也有三按钮
    expect(screen.getByText('+ 添加副申请人')).toBeInTheDocument()
    expect(screen.getByText('+ 一键添加家庭成员')).toBeInTheDocument()
    expect(screen.getByText('+ 关联现有客户')).toBeInTheDocument()
    // 切到「案件 / 家庭成员」tab，三按钮（家庭成员管理）仍在，与案件同 tab
    fireEvent.click(screen.getByRole('button', { name: '案件 / 家庭成员' }))
    expect(await screen.findByText('+ 关联现有客户')).toBeInTheDocument()
    expect(screen.getByText('+ 新建案件')).toBeInTheDocument() // 案件与家庭成员同在该 tab
  })

  it('底部归档 / 彻底删除常驻', async () => {
    renderPage()
    await screen.findByText('测试客户')
    expect(screen.getByText('归档')).toBeInTheDocument()
    expect(screen.getByText('彻底删除')).toBeInTheDocument()
  })
})
