import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthContext } from '../../providers/auth-context'
import type { AuthContextValue } from '../../providers/auth-context'
import type { Case, CaseStageHistory, Customer } from '../../types/models'
import { queryKeys } from '../../hooks/queries/keys'

const { CASE, CUST, HIST } = vi.hoisted(() => {
  const CUST = {
    id: 'cu1', full_name: '钱超萍', primary_applicant_id: null, client_source: null, is_starred: false,
    is_archived: false, gender: null, birth_date: null, sponsor_employer_id: null, sponsor_position: 'Finance Broker',
    referrer_id: null, notes: null, phone: null, email: null, created_at: '2024-01-01',
  }
  const CASE = {
    id: 'ca1', case_number: '12345678', customer_id: 'cu1', visa_subclass: '482', visa_stream: 'Core Skills',
    destination_country: 'Australia', sponsor_position: null, sponsor_employer_id: null,
    current_stage: 'granted', currency: 'AUD', sync_tracking: false, trt_reminder_enabled: false,
    parent_case_id: null, parent_sync_progress: false, assigned_to: null, created_by: null,
    is_archived: false, created_at: '', updated_at: '',
  }
  // 真实非线性：待办 直接跳 下签（中间阶段没走过）
  const HIST = [
    { id: 'h1', case_id: 'ca1', from_stage: 'todo', to_stage: 'granted', note: null, effective_at: '2026-05-20T10:00:00Z', changed_at: '2026-05-20T11:36:00Z', changed_by: null },
  ]
  return { CASE, CUST, HIST }
})

vi.mock('../../api/cases', async (orig) => {
  const actual = await orig<typeof import('../../api/cases')>()
  return {
    ...actual,
    getCase: vi.fn().mockResolvedValue(CASE as unknown as Case),
    getCaseStageHistory: vi.fn().mockResolvedValue(HIST as unknown as CaseStageHistory[]),
    listCasesByCustomer: vi.fn().mockResolvedValue([CASE] as unknown as Case[]),
  }
})
vi.mock('../../api/customers', async (orig) => {
  const actual = await orig<typeof import('../../api/customers')>()
  return {
    ...actual,
    getCustomer: vi.fn().mockResolvedValue(CUST as unknown as Customer),
    listCustomers: vi.fn().mockResolvedValue([CUST] as unknown as Customer[]),
  }
})
vi.mock('../../api/familyLinks', async (orig) => {
  const actual = await orig<typeof import('../../api/familyLinks')>()
  return { ...actual, listFamilyLinks: vi.fn().mockResolvedValue([]) }
})
vi.mock('../../api/caseApplicants', async (orig) => {
  const actual = await orig<typeof import('../../api/caseApplicants')>()
  return { ...actual, listCaseApplicants: vi.fn().mockResolvedValue([]) } // 一案一组：参与人=owner+case_applicants
})

import { CaseDetailPage } from './CaseDetailPage'

const authValue = {
  user: { id: 'u1' }, loading: false, session: null, profile: null, isAdmin: true,
  signIn: async () => {}, signOut: async () => {},
} as unknown as AuthContextValue

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, refetchOnMount: false } } })
  // 费用/待办区查询（无网络，确定性）
  qc.setQueryData(queryKeys.dashboard.plans, [])
  qc.setQueryData(queryKeys.dashboard.payments, [])
  qc.setQueryData(queryKeys.dashboard.planItems, [])
  qc.setQueryData(queryKeys.documents.byCase('ca1'), [])
  qc.setQueryData(queryKeys.records.byCase('ca1'), [])
  return render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={['/cases/ca1']}>
          <Routes>
            <Route path="/cases/:id" element={<CaseDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

describe('CaseDetailPage（单页 · 照「案件页面」图 · 无 tab）', () => {
  it('单页无 tab；Header= 衬线标题 + 客户·国家·Group·当前阶段 + 编辑案件', async () => {
    renderPage()
    expect(await screen.findByText('482 / Core Skills 签证')).toBeInTheDocument()
    // 旧 5 个 tab 全部消失
    for (const t of ['概览', '递交', '付款', '文件', '记录']) {
      expect(screen.queryByRole('button', { name: t })).not.toBeInTheDocument()
    }
    expect(screen.getAllByText('钱超萍').length).toBeGreaterThan(0) // header + 参与人 + 费用组头
    expect(screen.getByText('Australia')).toBeInTheDocument()
    expect(screen.getByText(/^Group G-[0-9A-Z]{4}$/)).toBeInTheDocument()
    expect(screen.getByText('编辑案件')).toBeInTheDocument()
  })

  it('概要带四格 + 本案信息五项（介绍人留 —）', async () => {
    renderPage()
    await screen.findByText('482 / Core Skills 签证')
    expect(screen.getByText('本案参与人')).toBeInTheDocument()
    expect(screen.getByText('本案待办 · 下一步')).toBeInTheDocument()
    expect(screen.getByText('本案费用（与客户联动）')).toBeInTheDocument()
    // 本案信息五项
    expect(screen.getByText('本案信息')).toBeInTheDocument()
    expect(screen.getByText('Subclass 482')).toBeInTheDocument()
    expect(screen.getByText('签证子类别')).toBeInTheDocument()
    expect(screen.getByText('担保职位')).toBeInTheDocument()
    expect(screen.getByText('担保雇主')).toBeInTheDocument()
    expect(screen.getByText('介绍人')).toBeInTheDocument()
  })

  it('🔒 阶段进展 = 真实非线性链：待办→下签，中间没走的阶段不出现', async () => {
    renderPage()
    await screen.findByText('482 / Core Skills 签证')
    const card = screen.getByText('阶段进展').closest('section') as HTMLElement
    expect(within(card).getByText('按实际记录，没走的阶段不显示')).toBeInTheDocument()
    expect(await within(card).findByText('待办')).toBeInTheDocument() // 历史异步加载
    expect(within(card).getAllByText('下签').length).toBeGreaterThan(0)
    // 没走过的阶段（提名递交/提名获批/签证递交）绝不出现在阶段进展卡里
    expect(within(card).queryByText('提名递交')).not.toBeInTheDocument()
    expect(within(card).queryByText('提名获批')).not.toBeInTheDocument()
    expect(within(card).queryByText('签证递交')).not.toBeInTheDocument()
    expect(within(card).getByText('推进阶段 →')).toBeInTheDocument()
    expect(within(card).getByText('阶段流转记录')).toBeInTheDocument()
  })

  it('左=本案待办空态；右=费用记录卡（与客户页同一组件）+ 本案合计；底部 归档/删除', async () => {
    renderPage()
    await screen.findByText('482 / Core Skills 签证')
    expect(screen.getByText('本案待办 · 要做的事')).toBeInTheDocument()
    expect(screen.getByText('本案暂无待办')).toBeInTheDocument()
    expect(screen.getByText('费用记录')).toBeInTheDocument()
    expect(screen.getByText('本案 · 按人拆分 · 与客户/财务联动同源')).toBeInTheDocument()
    expect(await screen.findByText('本案合计（全部客户）')).toBeInTheDocument() // 参与人查询异步加载

    expect(screen.getByText('归档案件')).toBeInTheDocument()
    expect(screen.getByText('彻底删除')).toBeInTheDocument()
  })

  it('本案待办可添加：要么记待办（内容+截止日），要么记带 emoji 的跟进', async () => {
    renderPage()
    await screen.findByText('482 / Core Skills 签证')
    fireEvent.click(screen.getByRole('button', { name: '+ 添加' }))
    // 默认 = 记待办
    expect(screen.getByRole('button', { name: '记待办' })).toBeInTheDocument()
    expect(screen.getByText('待办内容 *')).toBeInTheDocument()
    expect(screen.getByText('截止日（可选）')).toBeInTheDocument()
    // 切到 记跟进 → emoji 选择出现
    fireEvent.click(screen.getByRole('button', { name: '记跟进' }))
    expect(screen.getByText('跟进内容 *')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '💬' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '⚠️' })).toBeInTheDocument()
  })
})
