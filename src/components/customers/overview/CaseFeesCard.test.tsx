import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { CaseFeesCard } from './CaseFeesCard'
import { AuthContext } from '../../../providers/auth-context'
import type { AuthContextValue } from '../../../providers/auth-context'
import { queryKeys } from '../../../hooks/queries/keys'
import { receivableStatusBadgeClass } from '../../../lib/statusColor'
import { useUiStore } from '../../../store/ui'
import type { Case, CaseDocument, Customer, Payment, PaymentPlan, PaymentPlanItem } from '../../../types/models'

// 复用现有 documents / payments flow（断言上传/删除/撤销/修改接到真实 api）
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
    getAllPlanItems: vi.fn().mockResolvedValue([]), // 删除后 invalidate 触发的 refetch 不打网络
    deletePayment: vi.fn().mockResolvedValue(undefined),
    createPayment: vi.fn().mockResolvedValue({ id: 'NEWPAY' }),
    updatePayment: vi.fn().mockResolvedValue({ id: 'PAY' }),
    deletePlanItem: vi.fn().mockResolvedValue(undefined),
    updatePlanItem: vi.fn().mockResolvedValue({ id: 'IT' }),
    createPlanItem: vi.fn().mockResolvedValue({ id: 'NEWITEM' }),
    createPaymentPlan: vi.fn().mockResolvedValue({ id: 'NEWPLAN' }),
  }
})
// 删除落库后 onSuccess 会 invalidate → refetch dashboard 聚合键；mock 成空避免打 supabase
vi.mock('../../../api/dashboard', async (orig) => {
  const actual = await orig<typeof import('../../../api/dashboard')>()
  return {
    ...actual,
    getAllPayments: vi.fn().mockResolvedValue([]),
    getAllPaymentPlans: vi.fn().mockResolvedValue([]),
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
const item = { id: 'IT', plan_id: 'PL', fee_category: '律师费', amount_due: 100, periods: 1, kind: null } as unknown as PaymentPlanItem
// 应付款项（两步第一步）：kind='payable'，挂同案件计划 PL
const payableItem = { id: 'PB', plan_id: 'PL', fee_category: '提名代理费', amount_due: 3000, periods: 1, kind: 'payable' } as unknown as PaymentPlanItem
// 归属应付款项 PB 的实付支出（两步第二步）
const expLinked = {
  id: 'EX1', case_id: 'ca1', applicant_id: null, direction: 'to_company', plan_item_id: 'PB',
  amount: 3000, currency: 'AUD', method: 'transfer', paid_at: '2026-06-01', note: '提名代理费',
} as unknown as Payment
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

function renderCard(docs: CaseDocument[] = [], payments: Payment[] = [payment], planItems: PaymentPlanItem[] = [item]) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity, refetchOnMount: false } },
  })
  const seed = (k: readonly unknown[], d: unknown) => qc.setQueryData(k, d)
  seed(queryKeys.dashboard.plans, [plan])
  seed(queryKeys.dashboard.payments, payments)
  seed(queryKeys.dashboard.planItems, planItems)
  seed(queryKeys.customers.list({}), [customer])
  seed(queryKeys.caseApplicants.byCase('ca1'), []) // 一案一组：单人组=仅 cu1
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

const openMenu = (label: string) => fireEvent.click(screen.getByRole('button', { name: label }))

beforeEach(() => vi.clearAllMocks())

describe('CaseFeesCard（费用卡 · 重排：横向阅读线 + ⋯ 菜单 + chevron）', () => {
  it('删除「款项/金额/状态/操作」列表头（行已自解释）', async () => {
    renderCard()
    await screen.findByText('本案合计（全部客户）')
    // 旧列表头四个并排标题不应作为独立小标题存在（「操作」「状态」表头噪音删除）
    expect(screen.queryByText('操作')).not.toBeInTheDocument()
  })

  it('已收款行：行尾只有 ⋯，无「记收款」主操作、无独立「管理/改/删除」按钮', async () => {
    renderCard() // 律师费已收 100 → settled
    await screen.findByText('应收合计')
    expect(screen.getByRole('button', { name: '款项操作' })).toBeInTheDocument() // ⋯
    expect(screen.queryByRole('button', { name: '记收款' })).not.toBeInTheDocument()
    // 旧的行内独立按钮已撤掉
    expect(screen.queryByRole('button', { name: '管理' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '改款项' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '删除款项' })).not.toBeInTheDocument()
  })

  it('待付款行：同时有「记收款」主操作 + ⋯', async () => {
    renderCard([], []) // 无收款 → 待付款
    await screen.findByText('应收合计')
    expect(screen.getByRole('button', { name: '记收款' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '款项操作' })).toBeInTheDocument()
  })

  it('收款行 ⋯ 含且仅含：收款明细 / 修改款项 / 删除款项', async () => {
    renderCard()
    await screen.findByText('应收合计')
    openMenu('款项操作')
    const items = screen.getAllByRole('menuitem')
    expect(items.map((b) => b.textContent)).toEqual(['收款明细', '修改款项', '删除款项'])
    expect(screen.queryByRole('menuitem', { name: '修改支出' })).not.toBeInTheDocument()
  })

  it('行展开/收起：chevron 切换分期收款明细列表', async () => {
    renderCard() // 有一笔收款 PAY（2026-05-01）
    await screen.findByText('应收合计')
    expect(screen.queryByText('2026-05-01')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '展开收款明细' }))
    expect(screen.getByText('2026-05-01')).toBeInTheDocument() // 明细出现
    fireEvent.click(screen.getByRole('button', { name: '展开收款明细' }))
    expect(screen.queryByText('2026-05-01')).not.toBeInTheDocument() // 收起
  })

  it('状态 chip 颜色取自 lib/statusColor（已收款=绿、待付款=蓝），非组件硬编码', async () => {
    const { unmount } = renderCard() // settled
    const settled = await screen.findByText('已收款')
    expect(settled.className).toContain(receivableStatusBadgeClass('settled')) // bg-emerald-50 text-emerald-700
    expect(settled.className).toContain('emerald')
    unmount()
    renderCard([], []) // owing
    const owing = await screen.findByText('待付款')
    expect(owing.className).toContain(receivableStatusBadgeClass('owing')) // bg-[#e7eefc] text-[#3f7cb5]
    expect(owing.className).toContain('#3f7cb5') // 蓝，非灰
  })
})

describe('CaseFeesCard — 收款的修改（算法不变，记录是输入）', () => {
  it('修改一笔收款（金额/日期）→ updatePayment 带新值（已收/净额随之重算）', async () => {
    renderCard()
    await screen.findByText('应收合计')
    fireEvent.click(screen.getByRole('button', { name: '展开收款明细' }))
    fireEvent.click(screen.getByRole('button', { name: '改这笔' }))
    const amt = screen.getByLabelText(/修改金额/) as HTMLInputElement
    expect(amt.value).toBe('100')
    fireEvent.change(amt, { target: { value: '60' } })
    fireEvent.change(screen.getByLabelText(/修改日期/), { target: { value: '2026-05-03' } })
    fireEvent.click(screen.getByRole('button', { name: '保存修改' }))
    await waitFor(() =>
      expect(payApi.updatePayment).toHaveBeenCalledWith('PAY', expect.objectContaining({ amount: 60, paid_at: '2026-05-03' })),
    )
  })
})

describe('CaseFeesCard — 款项条目的修改 / 删除（⋯ 菜单）', () => {
  it('修改款项：⋯ → 修改款项 → 改金额/类别 → updatePlanItem', async () => {
    renderCard()
    await screen.findByText('应收合计')
    openMenu('款项操作')
    fireEvent.click(screen.getByRole('menuitem', { name: '修改款项' }))
    const amt = screen.getByLabelText(/修改金额/) as HTMLInputElement
    expect(amt.value).toBe('100')
    fireEvent.change(amt, { target: { value: '5000' } })
    fireEvent.change(screen.getByLabelText('款项类型'), { target: { value: '文案费' } })
    fireEvent.click(screen.getByRole('button', { name: '保存修改' }))
    await waitFor(() =>
      expect(payApi.updatePlanItem).toHaveBeenCalledWith('IT', expect.objectContaining({ amount_due: 5000, fee_category: '文案费' })),
    )
  })

})

describe('CaseFeesCard（照图：分组/小计/添加入口/无旧三列）', () => {
  it('组头=主申名、小计 strip、本案合计；「+ 给 X 添加款项」轻量表单；无应付/分期/全局下拉/旧三列', async () => {
    renderCard()
    expect(await screen.findByText('本案合计（全部客户）')).toBeInTheDocument()
    expect(screen.getByText('应收合计')).toBeInTheDocument()
    expect(screen.getAllByText('已收').length).toBeGreaterThan(0)
    expect(screen.getAllByText('未收').length).toBeGreaterThan(0)
    expect(screen.getByText(/本案净额（收款 − 支出）/)).toBeInTheDocument()
    // 应收分组里不混应付：应收行/小计 strip 不出现「应付」（应付款项在独立的支出区两步块）
    expect(screen.queryByText('应付款项小计')).not.toBeInTheDocument()
    expect(screen.getByText('测试客户 小计')).toBeInTheDocument()
    expect(screen.queryByText(/选择参与人后添加款项/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '+ 给 测试客户 添加款项' }))
    expect(screen.getByText('款项类型')).toBeInTheDocument()
    expect(screen.getByText('备注（选填）')).toBeInTheDocument()
    expect(screen.queryByText(/分阶段收费/)).not.toBeInTheDocument()
    expect(screen.queryByText('已付')).not.toBeInTheDocument()
    expect(screen.queryByText('未付')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ 新增款项' })).not.toBeInTheDocument()
  })

  it('本案发票：只显示 doc_type=invoice；删除调用 archiveDocument', async () => {
    renderCard([invoiceDoc, passportDoc])
    expect(await screen.findByText('本案发票')).toBeInTheDocument()
    expect(screen.getByText('发票A.pdf')).toBeInTheDocument()
    expect(screen.queryByText('护照.pdf')).not.toBeInTheDocument()
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
})

describe('CaseFeesCard — 分组覆盖全部参与人（没记款的也显示）', () => {
  it('3 位参与人都出分组：有款的列款项+小计；没款的「本人暂无费用」+ 幽灵添加按钮；合计=各人小计之和', async () => {
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

    expect(await screen.findByText('贾乃亮')).toBeInTheDocument()
    expect(screen.getByText('李小璐')).toBeInTheDocument()
    expect(screen.getByText('PGONE')).toBeInTheDocument()
    expect(screen.getByText('律师费')).toBeInTheDocument()
    expect(screen.getByText('贾乃亮 小计')).toBeInTheDocument()
    expect(screen.getAllByText('本人暂无费用')).toHaveLength(2)
    expect(screen.queryByText('李小璐 小计')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ 给 李小璐 添加款项' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ 给 PGONE 添加款项' })).toBeInTheDocument()
    expect(screen.getByText('本案合计（全部客户）')).toBeInTheDocument()
    expect(screen.getAllByText(/1\.00/).length).toBeGreaterThanOrEqual(2)
  })
})

describe('CaseFeesCard — 本案支出对齐收款（两步：应付款项 → 记一笔实际支出）', () => {
  // 取「应付款项小计」里的待付/已付不污染断言：状态徽章在 PayableRow 行内
  const payableRow = () => screen.getByText('提名代理费').closest('div.border-b') as HTMLElement

  it('两步① 添加应付款项：款项类型/应付金额 → createPlanItem 写 kind=payable（懒建案件级计划）', async () => {
    renderCard([], [payment]) // 默认仅应收款项 IT
    fireEvent.click(await screen.findByRole('button', { name: '+ 添加应付款项' }))
    expect(screen.getByText('款项类型')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/款项类型/), { target: { value: '律师费' } })
    fireEvent.change(screen.getByLabelText(/应付金额/), { target: { value: '3000' } })
    fireEvent.click(screen.getByRole('button', { name: '保存应付款项' }))
    await waitFor(() =>
      expect(payApi.createPlanItem).toHaveBeenCalledWith(
        expect.objectContaining({ fee_category: '律师费', amount_due: 3000, kind: 'payable' }),
      ),
    )
  })

  it('两步② 待付款行有「记支出」主操作 + ⋯；选付款对象/金额 → createPayment 关联 plan_item_id', async () => {
    renderCard([], [payment], [item, payableItem]) // 应付款项 PB 3000，无实付 → 待付款
    await screen.findByText('提名代理费')
    expect(within(payableRow()).getByText('待付款')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '记支出' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '应付款项操作' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '记支出' }))
    fireEvent.change(screen.getByLabelText(/付款对象/), { target: { value: 'to_referrer' } })
    const amt = screen.getByLabelText(/金额/) as HTMLInputElement
    expect(amt.value).toBe('3000') // 默认待付额
    fireEvent.click(screen.getByRole('button', { name: '确认支出' }))
    await waitFor(() =>
      expect(payApi.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({ case_id: 'ca1', direction: 'to_referrer', plan_item_id: 'PB', amount: 3000, applicant_id: null }),
      ),
    )
  })

  it('实付覆盖应付 → 状态 待付款 → 已付；已付行无「记支出」主操作', async () => {
    renderCard([], [payment, expLinked], [item, payableItem]) // PB 3000，实付 3000 → 已付
    await screen.findByText('提名代理费')
    expect(within(payableRow()).getByText('已付')).toBeInTheDocument()
    expect(within(payableRow()).queryByText('待付款')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '记支出' })).not.toBeInTheDocument()
  })

  it('应付款项 ⋯ 含且仅含：支出明细 / 修改款项 / 删除款项', async () => {
    renderCard([], [payment], [item, payableItem])
    await screen.findByText('提名代理费')
    openMenu('应付款项操作')
    const items = screen.getAllByRole('menuitem')
    expect(items.map((b) => b.textContent)).toEqual(['支出明细', '修改款项', '删除款项'])
  })

  it('展开支出明细 → 列归属该款项的实付（付款对象 chip）；改这笔可改金额/日期/付款对象', async () => {
    renderCard([], [payment, expLinked], [item, payableItem])
    await screen.findByText('提名代理费')
    expect(screen.queryByText('2026-06-01')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '展开支出明细' }))
    expect(screen.getByText('2026-06-01')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '改这笔' }))
    fireEvent.change(screen.getByLabelText(/修改金额/), { target: { value: '2500' } })
    fireEvent.change(screen.getByLabelText('付款对象'), { target: { value: 'to_referrer' } })
    fireEvent.change(screen.getByLabelText(/修改日期/), { target: { value: '2026-06-05' } })
    fireEvent.click(screen.getByRole('button', { name: '保存修改' }))
    await waitFor(() =>
      expect(payApi.updatePayment).toHaveBeenCalledWith('EX1', expect.objectContaining({ amount: 2500, direction: 'to_referrer', paid_at: '2026-06-05' })),
    )
  })

  it('撤销一笔实付支出（展开→撤销这笔）→ 立即回「待付款」，状态随之重算', () => {
    renderCard([], [payment, expLinked], [item, payableItem]) // 已付
    expect(within(payableRow()).getByText('已付')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '展开支出明细' }))
    fireEvent.click(screen.getByRole('button', { name: '撤销这笔' }))
    expect(within(payableRow()).getByText('待付款')).toBeInTheDocument() // 回待付款
    expect(within(payableRow()).queryByText('已付')).not.toBeInTheDocument()
  })

  it('付款对象 主代理/介绍人 + 垫付，分别计入；本案净额 = 已收 − 支出合计：100 − 4150 = −4050', async () => {
    renderCard([], [payment, expCo, expRef, expMisc]) // 三类实付（expCo/expRef 为未挂款项历史、expMisc 垫付）
    expect(await screen.findByText('支出合计')).toBeInTheDocument()
    expect(screen.getByText(/付主代理 3,000\.00 · 付介绍人 800\.00 · 垫付杂项 350\.00/)).toBeInTheDocument()
    expect(screen.getByText(/本案净额（收款 − 支出）/)).toBeInTheDocument()
    expect(screen.getByText(/[-−]4,050\.00/)).toBeInTheDocument()
    expect(screen.getByText(/收款 .*100\.00.*支出 .*4,150\.00/)).toBeInTheDocument()
  })

  it('垫付杂项单步：+ 记垫付杂项 → 金额/方式 → createPayment(direction=misc, plan_item_id=null)', async () => {
    renderCard([], [payment])
    fireEvent.click(await screen.findByRole('button', { name: '+ 记垫付杂项' }))
    fireEvent.change(screen.getByLabelText(/金额/), { target: { value: '350' } })
    fireEvent.change(screen.getByLabelText('备注（选填）'), { target: { value: '体检费垫付' } })
    fireEvent.click(screen.getByRole('button', { name: '保存垫付' }))
    await waitFor(() =>
      expect(payApi.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({ case_id: 'ca1', direction: 'misc_expense', amount: 350, plan_item_id: null, applicant_id: null, note: '体检费垫付' }),
      ),
    )
  })

  it('垫付杂项行：无 chevron/状态/记付款主操作，⋯ 仅 修改支出 / 撤销·删除支出', async () => {
    renderCard([], [expMisc]) // 一条垫付
    await screen.findByText('本案支出')
    const miscRow = screen.getByText('体检费垫付').closest('li') as HTMLElement
    const u = within(miscRow)
    expect(u.queryByRole('button', { name: '展开支出明细' })).not.toBeInTheDocument()
    expect(u.queryByText('待付款')).not.toBeInTheDocument()
    expect(u.getByRole('button', { name: '支出操作' })).toBeInTheDocument()
    openMenu('支出操作')
    expect(screen.getAllByRole('menuitem').map((b) => b.textContent)).toEqual(['修改支出', '撤销·删除支出'])
  })

  it('未挂款项的历史支出（付主代理/付介绍人，无 plan_item_id）兜底列出，可改/撤销', async () => {
    renderCard([], [expCo]) // to_company 无 plan_item_id → 历史兜底
    expect(await screen.findByText('未挂款项的支出（历史）')).toBeInTheDocument()
    expect(screen.getByText('提名代理费')).toBeInTheDocument() // expCo.note
    expect(screen.getByRole('button', { name: '支出操作' })).toBeInTheDocument()
  })

  it('暂无应付款项/垫付：两处优雅空态 + 两个录入入口仍在', async () => {
    renderCard([], [payment])
    expect(await screen.findByText('本案暂无应付款项')).toBeInTheDocument()
    expect(screen.getByText('本案暂无垫付杂项')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ 添加应付款项' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ 记垫付杂项' })).toBeInTheDocument()
  })
})

describe('CaseFeesCard — 删除/撤销：乐观移除 + 可撤销 toast + 延迟落库（无 window.confirm）', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useUiStore.setState({ toasts: [] })
  })
  afterEach(() => {
    act(() => vi.runOnlyPendingTimers())
    vi.useRealTimers()
  })

  it('撤销收款：不弹 confirm、该笔立即消失、DB 未删；点「撤销」复位且 5s 后仍不删', () => {
    const confirmSpy = vi.spyOn(window, 'confirm')
    renderCard()
    screen.getByText('应收合计')
    fireEvent.click(screen.getByRole('button', { name: '展开收款明细' }))
    expect(screen.getByText('2026-05-01')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '撤销这笔' }))
    expect(confirmSpy).not.toHaveBeenCalled() // ① 无原生确认框
    expect(screen.queryByText('2026-05-01')).not.toBeInTheDocument() // ② 立即消失
    expect(payApi.deletePayment).not.toHaveBeenCalled() // DB 未删
    const toast = useUiStore.getState().toasts.at(-1)!
    expect(toast.type).toBe('undo')
    expect(toast.action?.label).toBe('撤销')
    act(() => toast.action!.onClick()) // 点撤销
    expect(screen.getByText('2026-05-01')).toBeInTheDocument() // 复位
    act(() => vi.advanceTimersByTime(5000))
    expect(payApi.deletePayment).not.toHaveBeenCalled() // 撤销后永不落库
  })

  it('撤销收款：5s 无操作 → deletePayment 落库一次', async () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: '展开收款明细' }))
    fireEvent.click(screen.getByRole('button', { name: '撤销这笔' }))
    expect(payApi.deletePayment).not.toHaveBeenCalled()
    await act(async () => { vi.advanceTimersByTime(5000) })
    expect(payApi.deletePayment).toHaveBeenCalledTimes(1)
    expect(payApi.deletePayment).toHaveBeenCalledWith('PAY')
  })

  it('删除款项：立即移除该行 + 应收/合计立即重算（100 → 0）；5s 后 deletePlanItem 落库', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm')
    renderCard([], []) // 律师费 100 待付款（无收款）
    expect(screen.getByText('律师费')).toBeInTheDocument()
    expect(screen.getAllByText(/100\.00/).length).toBeGreaterThan(0)
    openMenu('款项操作')
    fireEvent.click(screen.getByRole('menuitem', { name: '删除款项' }))
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(screen.queryByText('律师费')).not.toBeInTheDocument() // 立即移除
    expect(screen.queryByText(/100\.00/)).not.toBeInTheDocument() // 应收重算
    expect(screen.getAllByText(/0\.00/).length).toBeGreaterThan(0)
    expect(payApi.deletePlanItem).not.toHaveBeenCalled()
    await act(async () => { vi.advanceTimersByTime(5000) })
    expect(payApi.deletePlanItem).toHaveBeenCalledWith('IT')
  })

  it('删除款项：toast 文案含款项名「律师费」；点撤销复位、不删 DB', () => {
    renderCard([], [])
    openMenu('款项操作')
    fireEvent.click(screen.getByRole('menuitem', { name: '删除款项' }))
    const toast = useUiStore.getState().toasts.at(-1)!
    expect(toast.message).toContain('律师费')
    act(() => toast.action!.onClick())
    expect(screen.getByText('律师费')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(5000))
    expect(payApi.deletePlanItem).not.toHaveBeenCalled()
  })

  it('撤销·删除支出：不弹 confirm、立即移除、5s 后 deletePayment 落库（双流净额随之重算）', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm')
    renderCard([], [expMisc]) // 体检费垫付 350
    expect(screen.getByText('体检费垫付')).toBeInTheDocument()
    openMenu('支出操作')
    fireEvent.click(screen.getByRole('menuitem', { name: '撤销·删除支出' }))
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(screen.queryByText('体检费垫付')).not.toBeInTheDocument()
    expect(payApi.deletePayment).not.toHaveBeenCalled()
    await act(async () => { vi.advanceTimersByTime(5000) })
    expect(payApi.deletePayment).toHaveBeenCalledWith('E3')
  })

  it('卸载/切页仍有 pending-delete → flush 落库，不漏删', async () => {
    const { unmount } = renderCard()
    fireEvent.click(screen.getByRole('button', { name: '展开收款明细' }))
    fireEvent.click(screen.getByRole('button', { name: '撤销这笔' }))
    expect(payApi.deletePayment).not.toHaveBeenCalled()
    await act(async () => { unmount() })
    expect(payApi.deletePayment).toHaveBeenCalledTimes(1)
    expect(payApi.deletePayment).toHaveBeenCalledWith('PAY')
  })
})
