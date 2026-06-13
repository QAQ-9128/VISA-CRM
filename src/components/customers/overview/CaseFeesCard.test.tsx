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
  return {
    ...actual,
    deletePayment: vi.fn().mockResolvedValue(undefined),
    createPayment: vi.fn().mockResolvedValue({ id: 'NEWPAY' }),
  }
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
// 支出三类（与财务账目同源的 payments 行；plan_item_id=null 不进应收）
const expCo = {
  id: 'E1', case_id: 'ca1', applicant_id: null, direction: 'to_company', plan_item_id: null,
  amount: 3000, currency: 'AUD', method: 'transfer', paid_at: '2026-06-01', note: '提名代理费',
} as unknown as Payment
const expRef = { ...expCo, id: 'E2', direction: 'to_referrer', amount: 800, paid_at: '2026-06-03', note: '介绍佣金' } as unknown as Payment
const expMisc = { ...expCo, id: 'E3', direction: 'misc_expense', amount: 350, paid_at: '2026-06-02', note: '体检费垫付' } as unknown as Payment

const invoiceDoc = {
  id: 'D1', customer_id: 'cu1', case_id: 'ca1', doc_type: 'invoice', file_name: '发票A.pdf',
  storage_path: 'cu1/ca1/a.pdf', title: null, is_archived: false, created_at: '2026-05-01',
} as unknown as CaseDocument
const passportDoc = { ...invoiceDoc, id: 'D2', doc_type: 'passport', file_name: '护照.pdf' } as unknown as CaseDocument

const authValue = {
  user: { id: 'u1' }, loading: false, session: null, profile: null, isAdmin: true,
  signIn: async () => {}, signOut: async () => {},
} as unknown as AuthContextValue

function renderCard(docs: CaseDocument[] = [], payments: Payment[] = [payment]) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity, refetchOnMount: false } },
  })
  const seed = (k: readonly unknown[], d: unknown) => qc.setQueryData(k, d)
  seed(queryKeys.dashboard.plans, [plan])
  seed(queryKeys.dashboard.payments, payments)
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
    // 本案净额（收款 − 支出）：仅 from_client 100、无支出 → 净额 = 100
    expect(screen.getByText(/本案净额（收款 − 支出）/)).toBeInTheDocument()
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

describe('CaseFeesCard — 本案支出（三类实付，与财务账目联动同源）', () => {
  it('支出区：三类支出行（类型标签+备注+金额+日期）+ 三类小计与合计；收款不混入；应收合计不受影响', async () => {
    renderCard([], [payment, expCo, expRef, expMisc])
    expect(await screen.findByText('本案支出')).toBeInTheDocument()
    // 三类标签 + 备注
    expect(screen.getByText('付主代理')).toBeInTheDocument()
    expect(screen.getByText('付介绍人')).toBeInTheDocument()
    expect(screen.getByText('垫付杂项')).toBeInTheDocument()
    expect(screen.getByText('提名代理费')).toBeInTheDocument()
    expect(screen.getByText('体检费垫付')).toBeInTheDocument()
    // 合计 = 3000 + 800 + 350；分类小计小字
    expect(screen.getByText('支出合计')).toBeInTheDocument()
    expect(screen.getAllByText(/4,150\.00/).length).toBeGreaterThan(0)
    expect(screen.getByText(/付主代理 3,000\.00 · 付介绍人 800\.00 · 垫付杂项 350\.00/)).toBeInTheDocument()
    // 应收侧改前=改后：合计区仍是 100 已收（支出不进应收）
    expect(screen.getByText('本案合计（全部客户）')).toBeInTheDocument()
    expect(screen.getAllByText(/100\.00/).length).toBeGreaterThan(0)
  })

  it('本案净额 = 已收 − 支出合计（含垫付）：100 − (3000+800+350) = −4050', async () => {
    renderCard([], [payment, expCo, expRef, expMisc])
    expect(await screen.findByText(/本案净额（收款 − 支出）/)).toBeInTheDocument()
    // 净额 = 100 − 4150 = −4050（垫付杂项 350 计入支出）
    expect(screen.getByText(/[-−]4,050\.00/)).toBeInTheDocument()
    // 不应是排除垫付的 −3700
    expect(screen.queryByText(/[-−]3,700\.00/)).not.toBeInTheDocument()
    // 分量展示：收款 100 − 支出 4150（= 上方支出合计）
    expect(screen.getByText(/收款 .*100\.00.*支出 .*4,150\.00/)).toBeInTheDocument()
  })

  it('只有支出无收款：本案净额 = −支出合计（含垫付）', async () => {
    renderCard([], [expCo, expRef, expMisc]) // 3000 + 800 + 350，无 from_client
    expect(await screen.findByText(/本案净额（收款 − 支出）/)).toBeInTheDocument()
    expect(screen.getByText(/[-−]4,150\.00/)).toBeInTheDocument()
  })

  it('+ 记支出：类型/金额/日期/方式/备注 → createPayment 写对 direction/case_id，无 applicant/款项归属', async () => {
    renderCard([], [payment])
    fireEvent.click(await screen.findByRole('button', { name: '+ 记支出' }))
    // 默认类型=付主代理，可切换为垫付杂项
    fireEvent.change(screen.getByLabelText('支出类型'), { target: { value: 'misc_expense' } })
    fireEvent.change(screen.getByLabelText(/金额/), { target: { value: '350' } })
    fireEvent.change(screen.getByLabelText('备注（选填）'), { target: { value: '体检费垫付' } })
    fireEvent.click(screen.getByRole('button', { name: '保存支出' }))
    await waitFor(() =>
      expect(payApi.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          case_id: 'ca1',
          direction: 'misc_expense',
          amount: 350,
          currency: 'AUD',
          note: '体检费垫付',
          applicant_id: null,
          plan_item_id: null,
        }),
      ),
    )
    // 实际日期默认今天（本地日历日），随表单提交
    const arg = vi.mocked(payApi.createPayment).mock.calls[0][0] as { paid_at?: string | null }
    expect(arg.paid_at).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('撤销支出 → 现有 deletePayment（账目随缓存失效联动刷新）', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderCard([], [payment, expMisc])
    await screen.findByText('本案支出')
    fireEvent.click(screen.getByRole('button', { name: '撤销支出' }))
    await waitFor(() => expect(payApi.deletePayment).toHaveBeenCalledWith('E3'))
  })

  it('暂无支出：优雅空态 + 记支出入口仍在', async () => {
    renderCard([], [payment])
    expect(await screen.findByText('本案暂无支出')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ 记支出' })).toBeInTheDocument()
  })

  it('支出实际日期禁未来：输入框带 max=今天，手输未来日期保存被拦（不调 createPayment）', async () => {
    renderCard([], [payment])
    fireEvent.click(await screen.findByRole('button', { name: '+ 记支出' }))
    const dateInput = screen.getByLabelText(/实际日期/) as HTMLInputElement
    expect(dateInput.max).toMatch(/^\d{4}-\d{2}-\d{2}$/) // max=今天（本地日历日）
    fireEvent.change(screen.getByLabelText(/金额/), { target: { value: '100' } })
    fireEvent.change(dateInput, { target: { value: '2999-01-01' } }) // 绕过 max 的手输
    fireEvent.click(screen.getByRole('button', { name: '保存支出' }))
    await waitFor(() => expect(payApi.createPayment).not.toHaveBeenCalled())
  })
})
