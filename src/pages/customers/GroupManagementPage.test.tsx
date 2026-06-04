import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthContext } from '../../providers/auth-context'
import type { AuthContextValue } from '../../providers/auth-context'
import { caseGroupCode } from '../../lib/caseGroups'
import type { Case, CaseApplicant, Customer } from '../../types/models'

// A=王芳、B=李雷、C=赵璞；案件 ca1 = A+B（A 拥有）、ca2 = A 独立 → A 同时在两个组里
const { A, B, C, CA1, CA2, APS } = vi.hoisted(() => {
  const base = {
    primary_applicant_id: null, relationship_to_primary: null, client_source: null, is_starred: false,
    is_archived: false, gender: null, birth_date: null, sponsor_employer_id: null, sponsor_position: null,
    referrer_id: null, notes: null, phone: null, email: null, created_at: '2024-01-01', updated_at: '',
  }
  const A = { ...base, id: 'A', full_name: '王芳' }
  const B = { ...base, id: 'B', full_name: '李雷' }
  const C = { ...base, id: 'C', full_name: '赵璞' }
  const caseBase = {
    case_number: '11111111', customer_id: 'A', visa_subclass: '482', visa_stream: null,
    destination_country: null, sponsor_position: null, sponsor_employer_id: null, current_stage: 'todo',
    currency: 'AUD', sync_tracking: false, trt_reminder_enabled: false, parent_case_id: null,
    parent_sync_progress: false, assigned_to: null, created_by: null, is_archived: false,
    created_at: '2026-01-01', updated_at: '',
  }
  const CA1 = { ...caseBase, id: 'ca1', case_number: '11111111' }
  const CA2 = { ...caseBase, id: 'ca2', case_number: '22222222', created_at: '2026-02-01' }
  const APS = [{ id: 'ap1', case_id: 'ca1', customer_id: 'B', created_at: '' }]
  return {
    A: A as unknown as Customer, B: B as unknown as Customer, C: C as unknown as Customer,
    CA1: CA1 as unknown as Case, CA2: CA2 as unknown as Case, APS: APS as unknown as CaseApplicant[],
  }
})

vi.mock('../../api/customers', async (orig) => {
  const actual = await orig<typeof import('../../api/customers')>()
  return {
    ...actual,
    getCustomer: vi.fn(async (id: string) => [A, B, C].find((c) => c.id === id) ?? A),
    listCustomers: vi.fn().mockResolvedValue([A, B, C]),
  }
})
vi.mock('../../api/cases', async (orig) => {
  const actual = await orig<typeof import('../../api/cases')>()
  return { ...actual, listCases: vi.fn().mockResolvedValue([CA1, CA2]) }
})
vi.mock('../../api/caseApplicants', async (orig) => {
  const actual = await orig<typeof import('../../api/caseApplicants')>()
  return { ...actual, listAllCaseApplicants: vi.fn().mockResolvedValue(APS) }
})

import { GroupManagementPage } from './GroupManagementPage'

const authValue = {
  user: { id: 'u1' }, loading: false, session: null, profile: null, isAdmin: true,
  signIn: async () => {}, signOut: async () => {},
} as unknown as AuthContextValue

function renderAt(entry: string | { pathname: string; state?: unknown }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="/customers/:id/group" element={<GroupManagementPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

describe('GroupManagementPage（案件参与管理 · 一案一组）', () => {
  it('每个案件一块：A 同时在 A+B 案与独立案两个组里，两块组码不同', async () => {
    renderAt('/customers/A/group')
    expect(await screen.findByText('案件参与管理')).toBeInTheDocument()
    expect(screen.getByText(/王芳 · 参与 2 件案件/)).toBeInTheDocument()
    // 两个案件块：组码各自派生且不同（单人案按案件 id 定码）
    const codeAB = caseGroupCode(['A', 'B'], 'ca1')
    const codeA = caseGroupCode(['A'], 'ca2')
    expect(codeAB).not.toBe(codeA)
    expect(await screen.findByText(codeAB)).toBeInTheDocument()
    expect(screen.getByText(codeA)).toBeInTheDocument()
    // A+B 案块里平铺参与人 王芳、李雷；赵璞不出现（不在任何案里）
    expect(screen.getAllByText('王芳').length).toBeGreaterThan(0)
    expect(screen.getByText('李雷')).toBeInTheDocument()
    expect(screen.queryByText('赵璞')).not.toBeInTheDocument()
  })

  it('「编辑参与人」链到案件表单（参与人增删在案件里做）；无任何 主/副申 字样', async () => {
    renderAt('/customers/A/group')
    await screen.findByText('案件参与管理')
    const editLinks = await screen.findAllByRole('link', { name: '编辑参与人 ›' })
    expect(editLinks.map((l) => l.getAttribute('href'))).toEqual(
      expect.arrayContaining(['/cases/ca1/edit', '/cases/ca2/edit']),
    )
    expect(screen.queryByText(/主申/)).not.toBeInTheDocument()
    expect(screen.queryByText(/副申/)).not.toBeInTheDocument()
  })

  it('参与人（非 owner）进入：李雷只看到 TA 参与的 A+B 案', async () => {
    renderAt('/customers/B/group')
    expect(await screen.findByText(/李雷 · 参与 1 件案件/)).toBeInTheDocument()
    expect(await screen.findByText(caseGroupCode(['A', 'B'], 'ca1'))).toBeInTheDocument()
    expect(screen.queryByText(caseGroupCode(['A'], 'ca2'))).not.toBeInTheDocument() // A 的独立案不显示
  })

  it('无案客户：空态 + 新建案件入口', async () => {
    renderAt('/customers/C/group')
    expect(await screen.findByText(/赵璞 · 参与 0 件案件/)).toBeInTheDocument()
    expect(screen.getByText('该客户暂无案件。')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '+ 新建案件' })).toHaveAttribute('href', '/cases/new?customer=C')
  })

  it('返回文案随来源：客户列表进来 →「返回客户列表」；无来源兜底「返回客户档案」', async () => {
    const r1 = renderAt({ pathname: '/customers/A/group', state: { from: 'customers' } })
    expect(await screen.findByText('返回客户列表')).toBeInTheDocument()
    r1.unmount()
    renderAt('/customers/A/group')
    expect(await screen.findByText('返回客户档案')).toBeInTheDocument()
  })
})
