import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { CasesPage } from './CasesPage'
import { queryKeys } from '../../hooks/queries/keys'
import type { Case, CaseApplicant, Customer, Employer, Lodgement } from '../../types/models'

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
const mkLodge = (o: Partial<Lodgement>): Lodgement => ({
  id: 'l1', case_id: 'ca1', type: 'nomination', lodged_date: '2026-03-01', reference_number: null,
  dha_processing_days: 120, dha_processing_updated_at: null, outcome: 'pending', outcome_date: null,
  note: null, created_by: null, created_at: '', updated_at: '', ...o,
})

const customers = [
  mkCust({ id: 'P', chinese_name: '陈伟', english_name: 'CHEN Wei', owner_referrer_id: 'own1' }),
  mkCust({ id: 'S', chinese_name: '林陆', relationship_to_primary: '配偶' }),
  mkCust({ id: 'W', chinese_name: '王芳' }),
]
const cases = [
  mkCase({ id: 'ca1', case_number: 'CASE-2026-014', customer_id: 'P', visa_subclass: '482', sponsor_position: 'Cook 厨师', sponsor_employer_id: 'e1' }),
  mkCase({ id: 'ca2', case_number: 'CASE-2026-021', customer_id: 'W', visa_subclass: '485', visa_stream: 'Post-Study Work', current_stage: 'todo' }),
]
const applicants: CaseApplicant[] = [{ id: 'a1', case_id: 'ca1', customer_id: 'S', created_at: '' }]
const lodgements: Lodgement[] = [mkLodge({ id: 'l1', case_id: 'ca1', type: 'nomination' })]
const employers = [{ id: 'e1', name: 'Golden Wok Pty Ltd', is_archived: false }] as unknown as Employer[]

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity, refetchOnMount: false } },
  })
  const seed = (k: readonly unknown[], d: unknown) => qc.setQueryData(k, d)
  seed(queryKeys.lodgements.lodged, lodgements)
  seed(queryKeys.cases.list, cases)
  seed(queryKeys.customers.list({}), customers)
  seed(queryKeys.caseApplicants.all, applicants)
  seed(queryKeys.cases.stageHistoryAll, [])
  seed(queryKeys.records.open, [])
  seed(queryKeys.employers.list, employers)
  seed(queryKeys.referrers.list, [])
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <CasesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const tableShown = () => screen.queryByText('提名递交时间') !== null // 表头唯进度表有
const boardShown = () => screen.queryAllByText('本案参与人').length > 0 // 卡片唯看板有

describe('CasesPage — 进度表 / 看板 段控', () => {
  it('存在「进度表 / 看板」段控；默认显示进度表（进入页面行为不变）', () => {
    renderPage()
    expect(screen.getByRole('button', { name: '进度表' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '看板' })).toBeInTheDocument()
    expect(tableShown()).toBe(true)
    expect(boardShown()).toBe(false)
  })

  it('切到「看板」→ 渲染案件卡（含四要素：签证/职位/担保雇主/参与人）', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: '看板' }))
    expect(boardShown()).toBe(true)
    expect(tableShown()).toBe(false)
    const card = screen.getByText('CASE-2026-014').closest('article') as HTMLElement
    const u = within(card)
    expect(u.getByText('482 TSS')).toBeInTheDocument()
    expect(u.getByText('Cook 厨师')).toBeInTheDocument()
    expect(u.getByText('Golden Wok Pty Ltd')).toBeInTheDocument()
    expect(u.getByText('林陆')).toBeInTheDocument()
  })

  it('共享筛选：同一搜索下进度表与看板呈现的案件集合一致', () => {
    renderPage()
    // 搜索 485 → 只剩 ca2
    fireEvent.change(screen.getByPlaceholderText(/搜索客户/), { target: { value: '485' } })
    expect(screen.getByText('CASE-2026-021')).toBeInTheDocument()
    expect(screen.queryByText('CASE-2026-014')).not.toBeInTheDocument()
    // 切看板：同一筛选结果（仍只剩 ca2）
    fireEvent.click(screen.getByRole('button', { name: '看板' }))
    expect(screen.getByText('CASE-2026-021')).toBeInTheDocument()
    expect(screen.queryByText('CASE-2026-014')).not.toBeInTheDocument()
  })

  it('卡片「查看进度 →」→ 切回进度表并定位该案件（搜索定位到其案件号）', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: '看板' }))
    const card = screen.getByText('CASE-2026-014').closest('article') as HTMLElement
    fireEvent.click(within(card).getByRole('button', { name: '查看进度 →' }))
    // 回到进度表
    expect(tableShown()).toBe(true)
    expect(boardShown()).toBe(false)
    // 定位到该案件：搜索框=案件号，表内只剩该案
    expect((screen.getByPlaceholderText(/搜索客户/) as HTMLInputElement).value).toBe('CASE-2026-014')
    expect(screen.getByText('CASE-2026-014')).toBeInTheDocument()
    expect(screen.queryByText('CASE-2026-021')).not.toBeInTheDocument()
  })
})
