import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { CustomerListPage } from './CustomerListPage'
import { queryKeys } from '../../hooks/queries/keys'
import type { Case, CaseApplicant, Customer } from '../../types/models'

const mkCust = (o: Partial<Customer>): Customer => ({
  id: 'c1', full_name: '甲', chinese_name: null, english_name: null, birth_date: null, gender: null,
  passport_no: null, nationality: null, phone: null, email: null, wechat: null, address: null,
  sponsor_employer_id: null, sponsor_position: null, referrer_id: null, owner_referrer_id: null,
  primary_applicant_id: null, relationship_to_primary: null, client_source: null, is_starred: false,
  notes: null, assigned_to: null, created_by: null, is_archived: false, created_at: '', updated_at: '', ...o,
})
const mkCase = (o: Partial<Case>): Case => ({
  id: 'ca1', case_number: 'CASE-2026-014', customer_id: 'P', visa_subclass: '482', visa_stream: 'Core Skills',
  case_category: null, case_details: null, destination_country: null, sponsor_position: null, sponsor_employer_id: null,
  immi_account_id: null, current_stage: 'nomination_lodged', currency: 'AUD', sync_tracking: true,
  trt_reminder_enabled: false, trt_reminder_dismissed: false, cohab_reminder_enabled: false, cohab_reminder_last: null,
  parent_case_id: null, parent_sync_progress: false, assigned_to: null, created_by: null, is_archived: false,
  created_at: '', updated_at: '', ...o,
})

const customers = [
  mkCust({ id: 'P', chinese_name: '陈伟', is_starred: true }),
  mkCust({ id: 'W', chinese_name: '王芳' }),
]
const cases = [mkCase({ id: 'ca1', customer_id: 'P' })]
const applicants: CaseApplicant[] = []

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity, refetchOnMount: false } },
  })
  const seed = (k: readonly unknown[], d: unknown) => qc.setQueryData(k, d)
  seed(queryKeys.customers.list({ search: '' }), customers)
  seed(queryKeys.customers.list({}), customers)
  seed(queryKeys.cases.list, cases)
  seed(queryKeys.caseApplicants.all, applicants)
  seed(queryKeys.employers.list, [])
  seed(queryKeys.referrers.list, [])
  seed(queryKeys.dashboard.activeCases, [])
  seed(queryKeys.dashboard.plans, [])
  seed(queryKeys.dashboard.payments, [])
  seed(queryKeys.dashboard.planItems, [])
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <CustomerListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CustomerListPage — 案件看板挪走后恢复纯列表', () => {
  it('不再出现「列表 / 看板」切换段控', () => {
    renderPage()
    expect(screen.queryByRole('button', { name: '看板' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '列表' })).not.toBeInTheDocument()
    // 也不应混进案件看板的「本案参与人」卡片结构
    expect(screen.queryByText('本案参与人')).not.toBeInTheDocument()
  })

  it('客户列表正常渲染：标题、搜索框、客户行、筛选按钮', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: '客户列表' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('搜索姓名 / 电话 / 邮箱 / 案件号')).toBeInTheDocument()
    expect(screen.getByText('陈伟')).toBeInTheDocument()
    expect(screen.getByText('王芳')).toBeInTheDocument()
  })
})
