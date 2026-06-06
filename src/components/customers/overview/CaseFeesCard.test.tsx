import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { CaseFeesCard } from './CaseFeesCard'
import { AuthContext } from '../../../providers/auth-context'
import type { AuthContextValue } from '../../../providers/auth-context'
import { queryKeys } from '../../../hooks/queries/keys'
import type { Case, CaseDocument, Customer, Payment, PaymentPlan, PaymentPlanItem } from '../../../types/models'

// 复用现有 documents / payments flow（断言上传/删除/撤销接到真实 api）
vi.mock('../../../api/documents', async (orig) => {
  const actual = await orig<typeof import('../../../api/documents')>()
  return {
    ...actual,
    uploadFile: vi.fn().mockResolvedValue({ storage_path: 'cu1/ca1/x-inv.pdf', file_name: 'inv.pdf' }),
    createDocument: vi.fn().mockResolvedValue({ id: 'D9' }),
    archiveDocument: vi.fn().mockResolvedValue(undefined),
    getDocumentSignedUrl: vi.fn().mockResolvedValue('https://signed'),
    listDocumentsByCase: vi.fn().mockResolvedValue([]),
  }
})
vi.mock('../../../api/payments', async (orig) => {
  const actual = await orig<typeof import('../../../api/payments')>()
  return { ...actual, deletePayment: vi.fn().mockResolvedValue(undefined) }
})

import * as docsApi from '../../../api/documents'
import * as payApi from '../../../api/payments'

const caseRow = {
  id: 'ca1', case_number: '12345678', customer_id: 'cu1', visa_subclass: 'Skill Assessment',
  visa_stream: null, current_stage: 'todo', currency: 'AUD', sync_tracking: true, is_archived: false,
} as unknown as Case
const customer = { id: 'cu1', full_name: '测试客户', primary_applicant_id: null } as unknown as Customer
const plan = { id: 'PL', case_id: 'ca1', applicant_id: 'cu1', currency: 'AUD' } as unknown as PaymentPlan
const item = { id: 'IT', plan_id: 'PL', fee_category: '律师费', amount_due: 100, periods: 1 } as unknown as PaymentPlanItem
const payment = {
  id: 'PAY', case_id: 'ca1', applicant_id: 'cu1', direction: 'from_client', plan_item_id: 'IT',
  amount: 100, currency: 'AUD', method: 'transfer', paid_at: '2026-05-01',
} as unknown as Payment
const invoiceDoc = {
  id: 'D1', customer_id: 'cu1', case_id: 'ca1', doc_type: 'invoice', file_name: '发票A.pdf',
  storage_path: 'cu1/ca1/a.pdf', title: null, is_archived: false, created_at: '2026-05-01',
} as unknown as CaseDocument
const passportDoc = { ...invoiceDoc, id: 'D2', doc_type: 'passport', file_name: '护照.pdf' } as unknown as CaseDocument

const authValue = {
  user: { id: 'u1' }, loading: false, session: null, profile: null, isAdmin: true,
  signIn: async () => {}, signOut: async () => {},
} as unknown as AuthContextValue

function renderCard(docs: CaseDocument[] = []) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity, refetchOnMount: false } },
  })
  const seed = (k: readonly unknown[], d: unknown) => qc.setQueryData(k, d)
  seed(queryKeys.dashboard.plans, [plan])
  seed(queryKeys.dashboard.payments, [payment])
  seed(queryKeys.dashboard.planItems, [item])
  seed(queryKeys.customers.list({}), [customer])
  seed(queryKeys.caseApplicants.byCase('ca1'), []) // 一案一组：参与人=owner+case_applicants（单人组=仅 cu1）
  seed(queryKeys.payments.byCase('ca1'), [payment])
  seed(queryKeys.cases.detail('ca1'), caseRow)
  seed(queryKeys.documents.byCase('ca1'), docs)
  return render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter>
          <CaseFeesCard caseRow={caseRow} />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

beforeEach(() => vi.clearAllMocks())

describe('CaseFeesCard（本案费用卡 · 单人）', () => {
  it('照图：组头=主申名、小计行、本案合计；「+ 给 X 添加款项」= 轻量表单；无应付/分期/全局下拉/旧三列', async () => {
    renderCard()
    // 底部「本案合计（全部客户）」三数
    expect(await screen.findByText('本案合计（全部客户）')).toBeInTheDocument()
    expect(screen.getByText('应收合计')).toBeInTheDocument()
    expect(screen.getAllByText('已收').length).toBeGreaterThan(0) // 底部 + 各人小计
    expect(screen.getAllByText('未收').length).toBeGreaterThan(0)
    expect(screen.queryByText('本案净额')).not.toBeInTheDocument()
    expect(screen.queryByText(/应付/)).not.toBeInTheDocument() // 纯应收：无主代理/介绍人应付行
    // 合并模式(sync_tracking=true)：组头=主申名 + 「[姓名] 小计」
    expect(screen.getByText('测试客户 小计')).toBeInTheDocument()
    // 无全局「选择参与人后添加款项」下拉；每人名下自己的添加入口
    expect(screen.queryByText(/选择参与人后添加款项/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '+ 给 测试客户 添加款项' }))
    // 轻量录入表单（类型/金额/备注），不是旧 PlanItemsTable
    expect(screen.getByText('款项类型')).toBeInTheDocument()
    expect(screen.getByText('备注（选填）')).toBeInTheDocument()
    expect(screen.queryByText(/分阶段收费/)).not.toBeInTheDocument()
    expect(screen.queryByText('已付')).not.toBeInTheDocument() // 旧「应收/已付/未付」三列没了
    expect(screen.queryByText('未付')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ 新增款项' })).not.toBeInTheDocument() // 旧合计表入口没了
  })

  it('本案发票：只显示 doc_type=invoice（不显示其它案件文件）；删除调用 archiveDocument', async () => {
    renderCard([invoiceDoc, passportDoc])
    expect(await screen.findByText('本案发票')).toBeInTheDocument()
    expect(screen.getByText('发票A.pdf')).toBeInTheDocument()
    expect(screen.queryByText('护照.pdf')).not.toBeInTheDocument() // 非发票不列入
    fireEvent.click(screen.getByRole('button', { name: '删除' }))
    await waitFor(() => expect(docsApi.archiveDocument).toHaveBeenCalledWith('D1'))
  })

  it('空发票优雅空态', async () => {
    renderCard([])
    expect(await screen.findByText('本案暂无发票')).toBeInTheDocument()
  })

  it('上传发票：带 customer_id + case_id + doc_type=invoice，复用现有 upload flow', async () => {
    const { container } = renderCard([])
    await screen.findByText('本案发票')
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['x'], 'inv.pdf', { type: 'application/pdf' })] } })
    await waitFor(() => expect(docsApi.uploadFile).toHaveBeenCalledWith(expect.any(File), 'cu1', 'ca1'))
    await waitFor(() =>
      expect(docsApi.createDocument).toHaveBeenCalledWith(
        expect.objectContaining({ customer_id: 'cu1', case_id: 'ca1', doc_type: 'invoice' }),
      ),
    )
  })

  it('操作列：已收款行点「…」→ 撤销触发现有 deletePayment', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderCard([])
    await screen.findByText('应收合计')
    // 律师费已收（paid=100）→ 状态 settled → 操作为「…」
    fireEvent.click(screen.getByRole('button', { name: '查看 / 撤销' }))
    fireEvent.click(screen.getByRole('button', { name: '撤销' }))
    await waitFor(() => expect(payApi.deletePayment).toHaveBeenCalledWith('PAY'))
  })
})

describe('CaseFeesCard — 分组覆盖全部参与人（没记款的也显示，bug 修复）', () => {
  it('3 位参与人都出分组：有款的列款项+小计；没款的「本人暂无费用」+ 可添加；合计=各人小计之和', async () => {
    // 贾乃亮（案件客户，名下 1 笔合并口径款项）+ 李小璐 / PGONE（本案参与客户、没记款）
    const jia = { id: 'cu1', full_name: '贾乃亮', primary_applicant_id: null } as unknown as Customer
    const li = { id: 'cu2', full_name: '李小璐', primary_applicant_id: null } as unknown as Customer
    const pg = { id: 'cu3', full_name: 'PGONE', primary_applicant_id: null } as unknown as Customer
    const mergedPlan = { id: 'PL', case_id: 'ca1', applicant_id: null, currency: 'AUD' } as unknown as PaymentPlan
    const feeItem = { id: 'IT', plan_id: 'PL', fee_category: '律师费', amount_due: 1, periods: 1 } as unknown as PaymentPlanItem

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity, refetchOnMount: false } },
    })
    qc.setQueryData(queryKeys.dashboard.plans, [mergedPlan])
    qc.setQueryData(queryKeys.dashboard.payments, [])
    qc.setQueryData(queryKeys.dashboard.planItems, [feeItem])
    qc.setQueryData(queryKeys.customers.list({}), [jia, li, pg])
    // 一案一组：参与人来自 case_applicants（李小璐、PGONE 为本案参与客户）
    qc.setQueryData(queryKeys.caseApplicants.byCase('ca1'), [
      { id: 'ap2', case_id: 'ca1', customer_id: 'cu2', created_at: '' },
      { id: 'ap3', case_id: 'ca1', customer_id: 'cu3', created_at: '' },
    ])
    qc.setQueryData(queryKeys.payments.byCase('ca1'), [])
    qc.setQueryData(queryKeys.documents.byCase('ca1'), [])
    render(
      <QueryClientProvider client={qc}>
        <AuthContext.Provider value={authValue}>
          <MemoryRouter>
            <CaseFeesCard caseRow={caseRow} />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>,
    )

    // 与顶部「本案参与人」同源：3 人都有分组（人数一致）
    expect(await screen.findByText('贾乃亮')).toBeInTheDocument()
    expect(screen.getByText('李小璐')).toBeInTheDocument()
    expect(screen.getByText('PGONE')).toBeInTheDocument()
    // 有款的人：款项行 + 小计；没款的人：「本人暂无费用」+ 自己的添加入口（无小计行）
    expect(screen.getByText('律师费')).toBeInTheDocument()
    expect(screen.getByText('贾乃亮 小计')).toBeInTheDocument()
    expect(screen.getAllByText('本人暂无费用')).toHaveLength(2)
    expect(screen.queryByText('李小璐 小计')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ 给 李小璐 添加款项' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ 给 PGONE 添加款项' })).toBeInTheDocument()
    // 🔒 合计改前=改后：应收 1.00 / 已收 0 / 未收 1.00（空分组小计 0 不影响）
    expect(screen.getByText('本案合计（全部客户）')).toBeInTheDocument()
    expect(screen.getAllByText(/1\.00/).length).toBeGreaterThanOrEqual(2) // 应收合计 + 未收
  })
})
