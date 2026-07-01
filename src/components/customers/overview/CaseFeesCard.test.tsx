import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { CaseFeesCard } from './CaseFeesCard'
import { AuthContext } from '../../../providers/auth-context'
import type { AuthContextValue } from '../../../providers/auth-context'
import { queryKeys } from '../../../hooks/queries/keys'
import { receivableStatusBadgeClass, expenseStatusBadgeClass } from '../../../lib/statusColor'
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
    createPlanItem: vi.fn().mockResolvedValue({ id: 'NEWIT' }),
    createPaymentPlan: vi.fn().mockResolvedValue({ id: 'NEWPL', case_id: 'ca1', applicant_id: 'cu1' }),
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

const HERO = '本案净额(已结口径)' // 顶部净额 hero 标签：渲染完成哨兵

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

function renderCard(docs: CaseDocument[] = [], payments: Payment[] = [payment], cr: Case = caseRow, items: PaymentPlanItem[] = [item]) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity, refetchOnMount: false } },
  })
  const seed = (k: readonly unknown[], d: unknown) => qc.setQueryData(k, d)
  seed(queryKeys.dashboard.plans, [plan])
  seed(queryKeys.dashboard.payments, payments)
  seed(queryKeys.dashboard.planItems, items)
  seed(queryKeys.customers.list({}), [customer])
  seed(queryKeys.caseApplicants.byCase('ca1'), []) // 一案一组：单人组=仅 cu1
  seed(queryKeys.payments.byCase('ca1'), [payment])
  seed(queryKeys.cases.detail('ca1'), cr)
  seed(queryKeys.documents.byCase('ca1'), docs)
  return render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter>
          <CaseFeesCard caseRow={cr} />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}
/** 分开记账（sync_tracking=false）→ 收款绑定写各自 applicant_id，断言更直观（PL / cu1）。 */
const caseSplit = { ...caseRow, sync_tracking: false } as unknown as Case

const openMenu = (label: string) => fireEvent.click(screen.getByRole('button', { name: label }))
// 类型现在是 FancySelect（按钮触发 + portal 浮层选项）：点触发器 → 点选项
const pickType = (optionName: string) => {
  fireEvent.click(screen.getByRole('button', { name: '录入类型' }))
  fireEvent.click(screen.getByRole('option', { name: optionName }))
}
// 支出列式 FancySelect（付款对象 / 方式）选择助手
const pickFancy = (triggerLabel: string, optionName: string) => {
  fireEvent.click(screen.getByRole('button', { name: triggerLabel }))
  fireEvent.click(screen.getByRole('option', { name: optionName }))
}
// 列式录入默认收起：先点开（第一个 = 客户组的「添加款项」；末尾另有「共享·全案」组的同名按钮）
const openFeeEditor = () => fireEvent.click(screen.getAllByRole('button', { name: '添加款项' })[0])
const openExpenseEditor = () => fireEvent.click(screen.getByRole('button', { name: '记一笔支出' }))
// 收款明细：行首 chevron 已移除 → 走 ⋯ 菜单展开
const openReceiptDetail = () => {
  openMenu('款项操作')
  fireEvent.click(screen.getByRole('menuitem', { name: '收款明细' }))
}
// 待支出（payable 款项，挂本案 plan PL，携带付款对象 expense_direction）
const payableExp = {
  id: 'PEX', plan_id: 'PL', fee_category: '服务费分成', amount_due: 500, periods: 1, note: null,
  kind: 'payable', expense_direction: 'to_company', created_at: '2026-06-01', updated_at: '',
} as unknown as PaymentPlanItem

beforeEach(() => vi.clearAllMocks())

describe('CaseFeesCard（费用记录 · 极简行 + 悬停显操作 + ⋯ 菜单）', () => {
  it('无「操作/状态」列表头噪音；顶部净额 hero 取代底部「本案合计」', async () => {
    renderCard()
    await screen.findByText(HERO)
    expect(screen.queryByText('操作')).not.toBeInTheDocument()
    expect(screen.queryByText('本案合计')).not.toBeInTheDocument() // 底部合计块已并入顶部 hero
  })

  it('已收款行：行尾编辑钮 + ⋯，无「记收款」主操作', async () => {
    renderCard() // 律师费已收 100 → settled
    await screen.findByText(HERO)
    expect(screen.getByRole('button', { name: '编辑款项' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '款项操作' })).toBeInTheDocument() // ⋯
    expect(screen.queryByRole('button', { name: '记收款' })).not.toBeInTheDocument()
  })

  it('待付款行：同时有「记收款」主操作 + 编辑 + ⋯', async () => {
    renderCard([], []) // 无收款 → 待付款
    await screen.findByText(HERO)
    expect(screen.getByRole('button', { name: '记收款' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '编辑款项' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '款项操作' })).toBeInTheDocument()
  })

  it('已收款行 ⋯ 含：收款明细 / 修改款项 / 改回待付（撤销收款）/ 删除款项', async () => {
    renderCard() // 律师费已收 100 → settled
    await screen.findByText(HERO)
    openMenu('款项操作')
    const items = screen.getAllByRole('menuitem')
    expect(items.map((b) => b.textContent)).toEqual(['收款明细', '修改款项', '改回待付（撤销收款）', '删除款项'])
    expect(screen.queryByRole('menuitem', { name: '修改支出' })).not.toBeInTheDocument()
  })

  it('待付款行 ⋯：记收款(窄屏兜底) / 收款明细 / 修改款项 / 删除款项（无「改回待付」）', async () => {
    renderCard([], []) // owing
    await screen.findByText(HERO)
    openMenu('款项操作')
    const items = screen.getAllByRole('menuitem')
    // 窄屏兜底「记收款」(sm:hidden) 在 jsdom 无 CSS 下也渲染，列首
    expect(items.map((b) => b.textContent)).toEqual(['记收款', '收款明细', '修改款项', '删除款项'])
  })

  it('收款明细走 ⋯ 菜单展开/收起逐笔收款列表（不再有行首 chevron）', async () => {
    renderCard() // 有一笔收款 PAY（2026-05-01）
    await screen.findByText(HERO)
    expect(screen.queryByText('2026-05-01')).not.toBeInTheDocument()
    openReceiptDetail()
    expect(screen.getByText('2026-05-01')).toBeInTheDocument() // 明细出现
    openReceiptDetail() // 再次切换 → 收起
    expect(screen.queryByText('2026-05-01')).not.toBeInTheDocument()
  })

  it('状态徽章颜色取自 lib/statusColor（已收款=绿、待付款=黄），非组件硬编码', async () => {
    const { unmount } = renderCard() // settled
    const settled = await screen.findByText('已收款')
    expect(settled.className).toContain(receivableStatusBadgeClass('settled'))
    expect(settled.className).toContain('emerald')
    unmount()
    renderCard([], []) // owing
    const owing = await screen.findByText('待付款')
    expect(owing.className).toContain(receivableStatusBadgeClass('owing'))
    expect(owing.className).toContain('#c08a2e') // 黄（列式录入改版），非蓝/灰
  })
})

describe('CaseFeesCard — 顶部净额 hero', () => {
  it('hero 展示 本案净额(已结口径) + 应收/已收/未收/已支出 四指标；净额=已收−已支出', async () => {
    // 已收 100；已支出 to_company 3000 + to_referrer 800 + 垫付 350 = 4150 → 净额 −4050
    renderCard([], [payment, expCo, expRef, expMisc])
    expect(await screen.findByText(HERO)).toBeInTheDocument()
    expect(screen.getByText(/[-−]4,050\.00/)).toBeInTheDocument() // 净额（无公式小字）
    expect(screen.queryByText(/[-−]3,700\.00/)).not.toBeInTheDocument()
    // 四指标标签
    expect(screen.getAllByText('应收').length).toBeGreaterThan(0)
    expect(screen.getAllByText('已收').length).toBeGreaterThan(0)
    expect(screen.getAllByText('未收').length).toBeGreaterThan(0)
    expect(screen.getAllByText('已支出').length).toBeGreaterThan(0)
    // 净额公式小字已砍
    expect(screen.queryByText(/收款 .*100\.00.*支出 .*4,150\.00/)).not.toBeInTheDocument()
  })
})

describe('CaseFeesCard — 收款的修改（算法不变，记录是输入）', () => {
  it('修改一笔收款（金额/日期）→ updatePayment 带新值（已收/净额随之重算）', async () => {
    renderCard()
    await screen.findByText(HERO)
    openReceiptDetail()
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

  it('修改款项：⋯ → 修改款项 → 改金额/类别 → updatePlanItem', async () => {
    renderCard()
    await screen.findByText(HERO)
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

  it('行内编辑钮（铅笔）也能开「修改款项」表单', async () => {
    renderCard()
    await screen.findByText(HERO)
    fireEvent.click(screen.getByRole('button', { name: '编辑款项' }))
    expect(screen.getByLabelText(/修改金额/)).toBeInTheDocument()
  })
})

describe('CaseFeesCard（分组卡 / 小计 / 列式录入默认收起）', () => {
  it('组头=客户名 + 已收小结；底栏 添加款项 + 应收/已收/未收 小计；无应付/旧三列；列式录入默认收起', async () => {
    renderCard()
    expect(await screen.findByText(HERO)).toBeInTheDocument()
    expect(screen.getByText('测试客户')).toBeInTheDocument()
    // 底栏小计（应收/已收/未收，无名字「小计」标签）
    expect(screen.getAllByText('已收').length).toBeGreaterThan(0)
    expect(screen.getAllByText('未收').length).toBeGreaterThan(0)
    expect(screen.queryByText(/应付/)).not.toBeInTheDocument()
    // 组头右侧「已收 100.00」小结
    expect(screen.getByText(/已收 .*100\.00/)).toBeInTheDocument()
    // ★默认收起（查看态）：不出现任何列式输入框，只有「添加款项」入口
    expect(screen.queryByLabelText('录入类型')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('录入描述')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('款额')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '添加款项' })[0]).toBeInTheDocument()
    // 共享·全案组恒在（客户组之外单列，供共享款项录入入口）
    expect(screen.getByText('共享 · 全案')).toBeInTheDocument()
    expect(screen.getByText('属于整个案件 · 不分个人')).toBeInTheDocument()
    // 点「添加款项」才展开列式输入
    openFeeEditor()
    expect(screen.getByLabelText('录入类型')).toBeInTheDocument()
    expect(screen.getByLabelText('录入描述')).toBeInTheDocument()
    expect(screen.getByLabelText('款额')).toBeInTheDocument()
    // 取消即收起
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(screen.queryByLabelText('录入类型')).not.toBeInTheDocument()
  })

  it('列式录入·待付：填类型(待付)+描述+金额 → 保存 → 仅 createPlanItem（不记收款），归到该客户名下', async () => {
    renderCard([], [], caseSplit) // 分开记账：绑定 cu1 / PL
    await screen.findByText(HERO)
    openFeeEditor()
    pickType('待付')
    fireEvent.change(screen.getByLabelText('录入描述'), { target: { value: '文案费' } })
    fireEvent.change(screen.getByLabelText('款额'), { target: { value: '1500' } })
    fireEvent.click(screen.getByRole('button', { name: /保存/ }))
    await waitFor(() =>
      expect(payApi.createPlanItem).toHaveBeenCalledWith(
        expect.objectContaining({ plan_id: 'PL', fee_category: '文案费', amount_due: 1500 }),
      ),
    )
    expect(payApi.createPayment).not.toHaveBeenCalled() // 待付不记收款
  })

  it('列式录入·收款：填类型(收款)+描述+金额 → 保存 → createPlanItem + 全额 from_client 收款(今天) 归到 cu1', async () => {
    renderCard([], [], caseSplit)
    await screen.findByText(HERO)
    openFeeEditor()
    pickType('收款')
    fireEvent.change(screen.getByLabelText('录入描述'), { target: { value: '律师费' } })
    fireEvent.change(screen.getByLabelText('款额'), { target: { value: '2000' } })
    fireEvent.click(screen.getByRole('button', { name: /保存/ }))
    await waitFor(() => expect(payApi.createPlanItem).toHaveBeenCalled())
    await waitFor(() =>
      expect(payApi.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          case_id: 'ca1', applicant_id: 'cu1', direction: 'from_client',
          plan_item_id: 'NEWIT', amount: 2000, currency: 'AUD',
        }),
      ),
    )
    const arg = vi.mocked(payApi.createPayment).mock.calls[0][0] as { paid_at?: string | null }
    expect(arg.paid_at).toMatch(/^\d{4}-\d{2}-\d{2}$/) // 本地今天
  })

  it('★描述可手填自定义值并保存：手填「加急费」（非预设项）→ createPlanItem(fee_category=加急费)', async () => {
    renderCard([], [], caseSplit)
    await screen.findByText(HERO)
    openFeeEditor()
    pickType('待付')
    fireEvent.change(screen.getByLabelText('录入描述'), { target: { value: '加急费' } })
    fireEvent.change(screen.getByLabelText('款额'), { target: { value: '888' } })
    fireEvent.click(screen.getByRole('button', { name: /保存/ }))
    await waitFor(() =>
      expect(payApi.createPlanItem).toHaveBeenCalledWith(
        expect.objectContaining({ fee_category: '加急费', amount_due: 888 }),
      ),
    )
  })

  it('★描述自定义值能读回：库中款项 fee_category=「加急费」→ 行内如实显示', async () => {
    const custom = { ...item, id: 'IT9', fee_category: '加急费' } as unknown as PaymentPlanItem
    renderCard([], [], caseRow, [custom])
    await screen.findByText(HERO)
    expect(screen.getByText('加急费')).toBeInTheDocument()
  })

  it('列式录入校验：类型/描述缺失或金额≤0 → 不出现保存按钮（拦截）', async () => {
    renderCard([], [])
    await screen.findByText(HERO)
    openFeeEditor()
    fireEvent.change(screen.getByLabelText('款额'), { target: { value: '300' } })
    expect(screen.queryByRole('button', { name: /保存/ })).not.toBeInTheDocument()
    pickType('待付')
    fireEvent.change(screen.getByLabelText('录入描述'), { target: { value: '律师费' } })
    fireEvent.change(screen.getByLabelText('款额'), { target: { value: '0' } })
    expect(screen.queryByRole('button', { name: /保存/ })).not.toBeInTheDocument()
  })

  it('添加款项展开一行 → 再加一行 → ✕ 删除一行', async () => {
    renderCard([], [])
    await screen.findByText(HERO)
    expect(screen.queryAllByLabelText('录入类型')).toHaveLength(0)
    openFeeEditor()
    expect(screen.getAllByLabelText('录入类型')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: '再加一行' }))
    expect(screen.getAllByLabelText('录入类型')).toHaveLength(2)
    fireEvent.click(screen.getAllByRole('button', { name: '删除该行' })[1])
    expect(screen.getAllByLabelText('录入类型')).toHaveLength(1)
  })

  it('★可逆：改回待付（撤销收款）已收行 ⋯ → 确认 → deletePayment 落库（金额归账不变）', async () => {
    vi.useFakeTimers()
    try {
      renderCard() // 律师费已收 100（PAY）
      openMenu('款项操作')
      fireEvent.click(screen.getByRole('menuitem', { name: '改回待付（撤销收款）' }))
      fireEvent.click(screen.getByRole('button', { name: '改回待付' })) // 二次确认
      await act(async () => {})
      expect(payApi.deletePayment).not.toHaveBeenCalled() // 延迟落库
      await act(async () => { vi.advanceTimersByTime(5000) })
      expect(payApi.deletePayment).toHaveBeenCalledWith('PAY')
    } finally {
      act(() => vi.runOnlyPendingTimers())
      vi.useRealTimers()
    }
  })
})

describe('CaseFeesCard — 本案发票', () => {
  it('只显示 doc_type=invoice；删除调用 archiveDocument', async () => {
    renderCard([invoiceDoc, passportDoc])
    expect(await screen.findByText('发票')).toBeInTheDocument()
    expect(screen.getByText('发票A.pdf')).toBeInTheDocument()
    expect(screen.queryByText('护照.pdf')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '删除' }))
    await waitFor(() => expect(docsApi.archiveDocument).toHaveBeenCalledWith('D1'))
  })

  it('空发票优雅空态 + 上传入口', async () => {
    renderCard([])
    expect(await screen.findByText('暂无发票')).toBeInTheDocument()
  })

  it('上传发票：带 customer_id + case_id + doc_type=invoice，复用现有 upload flow', async () => {
    const { container } = renderCard([])
    await screen.findByText('发票')
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
  it('3 位参与人都出分组；合计=各人小计之和；每组一个「添加款项」', async () => {
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
    expect(screen.queryByText('本人暂无费用')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '添加款项' })).toHaveLength(4) // 三客户组各一 + 共享·全案组一
    expect(screen.getAllByText(/1\.00/).length).toBeGreaterThanOrEqual(2)
  })
})

describe('CaseFeesCard — 本案支出（单层卡 · 收支对称待/已两态）', () => {
  it('★列式录入·实付=金额×百分比：付给公司 100×30% → 实付 30，入账 amount=30(非基数)', async () => {
    renderCard([], [])
    await screen.findByText('支出')
    openExpenseEditor()
    pickFancy('付款对象', '付给公司')
    pickFancy('支出方式', '现金')
    expect(screen.queryByLabelText('支出描述')).not.toBeInTheDocument() // 已去「描述」列
    fireEvent.change(screen.getByLabelText('支出金额'), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('支出百分比'), { target: { value: '30' } })
    expect(screen.getByText('100×30%')).toBeInTheDocument() // 算式
    expect(screen.getByText('30.00')).toBeInTheDocument() // 实付
    fireEvent.click(screen.getByRole('button', { name: /保存/ }))
    await waitFor(() =>
      expect(payApi.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          case_id: 'ca1', direction: 'to_company', amount: 30, applicant_id: null,
          plan_item_id: null, note: null, method: 'cash',
        }),
      ),
    )
  })

  it('百分比留空 = 100%：付给介绍人 100 留空 → 实付 100，amount=100（本地今天）', async () => {
    renderCard([], [])
    await screen.findByText('支出')
    openExpenseEditor()
    pickFancy('付款对象', '付给介绍人')
    pickFancy('支出方式', '转账')
    fireEvent.change(screen.getByLabelText('支出金额'), { target: { value: '100' } })
    fireEvent.click(screen.getByRole('button', { name: /保存/ }))
    await waitFor(() =>
      expect(payApi.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({ direction: 'to_referrer', amount: 100, method: 'transfer' }),
      ),
    )
    const arg = vi.mocked(payApi.createPayment).mock.calls[0][0] as { paid_at?: string | null }
    expect(arg.paid_at).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('已支出只读行：付款对象 chip + 实付(珊瑚) + 已支出徽章(色取 statusColor) + ⋯(撤销/删除)', async () => {
    renderCard([], [payment, expCo, expRef]) // 已支出：to_company 3000 + to_referrer 800
    await screen.findByText('支出')
    expect(screen.getByText('付给公司')).toBeInTheDocument()
    expect(screen.getByText('付给介绍人')).toBeInTheDocument()
    expect(screen.queryByText('提名代理费')).not.toBeInTheDocument() // 只读行不显描述
    // 已支出徽章色取 statusColor 单一来源（珊瑚）
    const paidBadge = screen.getAllByText('已支出').find((el) => el.className.includes('rounded-full'))!
    expect(paidBadge.className).toContain(expenseStatusBadgeClass('paid'))
    expect(paidBadge.className).toContain('coral')
    expect(screen.getAllByText(/3,800\.00/).length).toBeGreaterThan(0) // 已支出=hero=3800
    fireEvent.click(screen.getAllByRole('button', { name: '支出操作' })[0])
    // 「修改支出」为窄屏兜底（sm:hidden），jsdom 无 CSS 也渲染，列首
    expect(screen.getAllByRole('menuitem').map((b) => b.textContent)).toEqual(['修改支出', '撤销（改回待支出）', '删除支出'])
  })

  it('修改支出（编辑钮）：改实付金额 + 改付款对象(介绍人) → updatePayment', async () => {
    renderCard([], [expCo]) // 付给公司 3000
    await screen.findByText('支出')
    fireEvent.click(screen.getByRole('button', { name: '编辑支出' }))
    const amt = screen.getByLabelText('修改实付金额') as HTMLInputElement
    expect(amt.value).toBe('3000')
    fireEvent.change(amt, { target: { value: '2500' } })
    pickFancy('修改付款对象', '付给介绍人')
    fireEvent.click(screen.getByRole('button', { name: '保存修改' }))
    await waitFor(() =>
      expect(payApi.updatePayment).toHaveBeenCalledWith('E1', expect.objectContaining({ amount: 2500, direction: 'to_referrer' })),
    )
  })

  it('★可逆：待支出 → 记支出 → 已支出：付给公司 500 待支出 → 记支出 → createPayment(实付500) + 删 payable', async () => {
    renderCard([], [], caseRow, [item, payableExp]) // 待支出 PEX：付给公司 500
    await screen.findByText('支出')
    expect(screen.getAllByText('待支出').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/500\.00/).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: '记支出' }))
    await waitFor(() =>
      expect(payApi.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({ case_id: 'ca1', direction: 'to_company', amount: 500, plan_item_id: null, applicant_id: null, note: '服务费分成' }),
      ),
    )
    await waitFor(() => expect(payApi.deletePlanItem).toHaveBeenCalledWith('PEX'))
  })

  it('★可逆：已支出 → 撤销 → 待支出：⋯ → 撤销（改回待支出）→ 确认 → createPlanItem(payable,付款对象) + 延迟撤 payment', async () => {
    vi.useFakeTimers()
    try {
      renderCard([], [expCo]) // 付给公司 3000
      openMenu('支出操作')
      fireEvent.click(screen.getByRole('menuitem', { name: '撤销（改回待支出）' }))
      fireEvent.click(screen.getByRole('button', { name: '撤销' })) // 确认弹窗
      await act(async () => {})
      await act(async () => {})
      expect(payApi.createPlanItem).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'payable', expense_direction: 'to_company', amount_due: 3000 }),
      )
      expect(payApi.deletePayment).not.toHaveBeenCalled() // 延迟落库
      await act(async () => { vi.advanceTimersByTime(5000) })
      expect(payApi.deletePayment).toHaveBeenCalledWith('E1')
    } finally {
      act(() => vi.runOnlyPendingTimers())
      vi.useRealTimers()
    }
  })

  it('小结：已支出与待支出分列；只有已支出计入净额（垫付计入）', async () => {
    renderCard([], [expCo], caseRow, [item, payableExp]) // 已支出3000 + 待支出500
    await screen.findByText('支出')
    expect(screen.getAllByText('已支出').length).toBeGreaterThan(0)
    expect(screen.getAllByText('待支出').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/500\.00/).length).toBeGreaterThan(0) // 待支出 500
    expect(screen.getAllByText(/3,000\.00/).length).toBeGreaterThan(0) // 已支出/净额 3000（待支出不进）
  })

  it('★支出列式默认收起：仅「记一笔支出」入口，点开才出下拉/输入；取消即收起', async () => {
    renderCard([], [payment])
    expect(await screen.findByText('支出')).toBeInTheDocument()
    expect(screen.queryByLabelText('付款对象')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '记一笔支出' })).toBeInTheDocument()
    openExpenseEditor()
    expect(screen.getByLabelText('付款对象')).toBeInTheDocument()
    expect(screen.getByLabelText('支出方式')).toBeInTheDocument()
    expect(screen.queryByLabelText('支出描述')).not.toBeInTheDocument() // 已去描述列
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(screen.queryByLabelText('付款对象')).not.toBeInTheDocument()
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
    screen.getByText(HERO)
    openReceiptDetail()
    expect(screen.getByText('2026-05-01')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '撤销这笔' }))
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(screen.queryByText('2026-05-01')).not.toBeInTheDocument() // 立即消失
    expect(payApi.deletePayment).not.toHaveBeenCalled()
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
    openReceiptDetail()
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

  it('删除支出：不弹 confirm、立即移除、5s 后 deletePayment 落库（双流净额随之重算）', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm')
    renderCard([], [expMisc]) // 垫付杂项 350（只读行用付款对象 chip 定位）
    expect(screen.getByText('垫付杂项')).toBeInTheDocument()
    openMenu('支出操作')
    fireEvent.click(screen.getByRole('menuitem', { name: '删除支出' }))
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(screen.queryByText('垫付杂项')).not.toBeInTheDocument()
    expect(payApi.deletePayment).not.toHaveBeenCalled()
    await act(async () => { vi.advanceTimersByTime(5000) })
    expect(payApi.deletePayment).toHaveBeenCalledWith('E3')
  })

  it('卸载/切页仍有 pending-delete → flush 落库，不漏删', async () => {
    const { unmount } = renderCard()
    openReceiptDetail()
    fireEvent.click(screen.getByRole('button', { name: '撤销这笔' }))
    expect(payApi.deletePayment).not.toHaveBeenCalled()
    await act(async () => { unmount() })
    expect(payApi.deletePayment).toHaveBeenCalledTimes(1)
    expect(payApi.deletePayment).toHaveBeenCalledWith('PAY')
  })
})
