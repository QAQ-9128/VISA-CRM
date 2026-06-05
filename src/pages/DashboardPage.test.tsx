import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

// ── 受控数据替换 hooks（初始渲染零网络）────────────────────────────
const { dash, checklist } = vi.hoisted(() => ({
  dash: { data: null as unknown },
  checklist: { data: null as unknown },
}))
vi.mock('../hooks/queries/useDashboard', () => ({ useDashboard: () => dash.data }))
vi.mock('../hooks/queries/useChecklistView', () => ({ useChecklistView: () => checklist.data }))
vi.mock('../hooks/queries/useChecklist', () => ({
  useChecklist: () => ({ data: [], isPending: false }),
  useAddChecklistItem: () => ({ mutate: vi.fn(), isPending: false }),
  useToggleChecklistItem: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteChecklistItem: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: null, profile: null }) }))

import { DashboardPage } from './DashboardPage'

const stage = (stage: string, label: string, count: number, color: string) => ({ stage, label, count, color })
const looseItem = (id: string, content: string) => ({
  id, content, is_done: false, customer_id: null, case_id: null,
  created_by: null, created_at: '', updated_at: '',
})

function setDash(over: Record<string, unknown> = {}) {
  dash.data = {
    isPending: false, isError: false,
    activeCaseCount: 27,
    stageDistribution: [
      stage('todo', '待办', 5, '#9ba59b'),
      stage('drafted', '已草拟', 4, '#e0a23c'),
      stage('nomination_lodged', '提名递交', 5, '#3f7cb5'),
      stage('nomination_approved', '提名获批', 2, '#36b3c2'),
      stage('visa_lodged', '签证递交', 11, '#7c6fd6'),
      stage('granted', '下签', 10, '#4e9a6b'),
    ],
    todoCases: [
      { caseId: 'k1', customerId: 'cu1', customerName: '测试2222222', participants: [{ id: 'cu1', name: '测试2222222' }], visaLabel: '494' },
      { caseId: 'k2', customerId: 'cu2', customerName: '测试1111111', participants: [{ id: 'cu2', name: '测试1111111' }], visaLabel: '186' },
      { caseId: 'k3', customerId: 'cu3', customerName: '王璞', participants: [{ id: 'cu3', name: '王璞' }, { id: 'cu5', name: '孙佳琪' }], visaLabel: '482' },
      { caseId: 'k4', customerId: 'cu4', customerName: '邓韬（Dylan）', participants: [{ id: 'cu4', name: '邓韬（Dylan）' }], visaLabel: '482 · Subsequent Entrant' },
      { caseId: 'k5', customerId: 'cu5', customerName: '孙佳琪', participants: [{ id: 'cu5', name: '孙佳琪' }], visaLabel: '186 · Direct Entry' },
    ],
    thisMonthReceipts: 114,
    debtTotals: { clientOwesTotal: 196601.09, companyOwesTotal: 0 },
    customerDebts: [
      { customerId: 'cu6', customerName: '吕列隆', clientOwes: 190000.09, companyOwes: 0, color: 'blue' },
      { customerId: 'cu7', customerName: '何祥龙', clientOwes: 6600, companyOwes: 0, color: 'blue' },
      { customerId: 'cu8', customerName: '贾乃亮', clientOwes: 1, companyOwes: 0, color: 'blue' },
    ],
    expiringDocItems: [],
    trtReminders: [],
    overdueInstallments: [],
    ...over,
  }
}

function setChecklist(over: Record<string, unknown> = {}) {
  checklist.data = {
    items: [
      looseItem('t1', '2026/6/1 Guoywfan 提名'),
      looseItem('t2', '2026/6/1 祥龙 提名'),
      looseItem('t3', '蒋青霞 482+186 提名 · 合同未签'),
      looseItem('t4', '孙佳琪 + 副申请 材料复审 186DE 提名'),
      looseItem('t5', '张献元 李章垠 de facto'),
      looseItem('t6', '邓涛 李旻书 defacto'),
    ],
    openCount: 8,
    isPending: false,
    cases: [], customers: [], caseById: {}, customerById: {},
    ...over,
  }
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => { setDash(); setChecklist() })

describe('DashboardPage · 概览精简 5 块（mockup 重做）', () => {
  it('① Header：衬线问候 + 摘要行（待办/临近到期/本月已收）+ 新建客户（无搜索条/铃铛）', () => {
    const { container } = renderPage()
    const h = screen.getByRole('heading', { name: /你好/ })
    expect(h.className).toContain('font-serif')
    const sub = container.querySelector('header p')
    expect(sub?.textContent).toContain('待办 8 条')
    expect(sub?.textContent).toContain('临近到期 0 个')
    expect(sub?.textContent).toContain('本月已收 AUD 114.00')
    expect(screen.getByRole('link', { name: /新建客户/ })).toHaveAttribute('href', '/customers/new')
    // 搜索条与通知铃已删（2026-06-05 客户要求：没用）
    expect(screen.queryByText(/搜索客户 \/ 案件 \/ 参考号/)).toBeNull()
    expect(screen.queryByLabelText('通知')).toBeNull()
  })

  it('② KPI 四卡：进行中案件 27 / 待办事项 8 / 本月收款 114.00 / 欠款总额 196,601.09 + 角标 3 户欠款', () => {
    renderPage()
    expect(screen.getByText('进行中案件')).toBeInTheDocument()
    expect(screen.getByText('待办事项')).toBeInTheDocument()
    expect(screen.getByText('本月收款')).toBeInTheDocument()
    expect(screen.getByText('客户欠款总额')).toBeInTheDocument()
    expect(screen.getAllByText('27').length).toBeGreaterThan(0) // KPI + 环图中心
    expect(screen.getByText('114.00')).toBeInTheDocument()
    expect(screen.getByText('196,601.09')).toBeInTheDocument()
    expect(screen.getByText('3 户欠款')).toBeInTheDocument()
  })

  it('② KPI 卡可点：进行中案件 → /cases；本月收款 → /finance；待办/欠款卡是定位按钮', () => {
    renderPage()
    expect(screen.getByRole('link', { name: /进行中案件/ })).toHaveAttribute('href', '/cases')
    expect(screen.getByRole('link', { name: /本月收款/ })).toHaveAttribute('href', '/finance')
    expect(screen.getByRole('button', { name: /待办事项/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /客户欠款总额/ })).toBeInTheDocument()
  })

  it('③ 案件阶段分布：在办/已下签小字 + 六阶段图例计数逐一吻合', () => {
    renderPage()
    expect(screen.getByText('案件阶段分布')).toBeInTheDocument()
    expect(screen.getByText('在办 27 · 已下签 10')).toBeInTheDocument()
    for (const [label, count] of [['已草拟', 4], ['提名递交', 5], ['提名获批', 2], ['签证递交', 11]] as const) {
      const row = screen.getByText(label).closest('div')!
      expect(row.textContent).toContain(String(count))
    }
    expect(screen.getByRole('link', { name: /全部案件/ })).toHaveAttribute('href', '/cases')
  })

  it('③ 待办阶段案件：5 行（参与人 + 类别小字 + 待办 pill）；多参与人逐个列出且各自可点', () => {
    renderPage()
    expect(screen.getByText('待办阶段案件')).toBeInTheDocument()
    expect(screen.getByText('测试2222222')).toBeInTheDocument()
    expect(screen.getByText('邓韬（Dylan）')).toBeInTheDocument()
    expect(screen.getByText('482 · Subsequent Entrant')).toBeInTheDocument()
    expect(screen.getAllByText('待办').length).toBeGreaterThanOrEqual(5) // 行内 pill（+图例「待办」）
    // k3 行的两名参与人都显示，且各自是可点的链接（role=link，点击跳各自客户页）
    expect(screen.getAllByRole('link', { name: '王璞' }).length + screen.getAllByText('王璞').length).toBeGreaterThan(0)
    const participantLinks = screen.getAllByText('孙佳琪') // k3 参与人 + k5 自己的行
    expect(participantLinks.length).toBeGreaterThanOrEqual(2)
  })

  it('④ 待办清单：输入框 + 添加 + 浅绿临近到期空态条 + 逐条待办（随手记 + ✕）', () => {
    renderPage()
    expect(screen.getByText('待办清单')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/写一句待办/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '添加' })).toBeInTheDocument()
    expect(screen.getByText(/临近到期（签证 \/ 文件 \/ TRT）/)).toBeInTheDocument()
    expect(screen.getByText(/近 30 天无临近到期/)).toBeInTheDocument()
    expect(screen.getByText('2026/6/1 Guoywfan 提名')).toBeInTheDocument()
    expect(screen.getAllByText('随手记')).toHaveLength(6)
    expect(screen.getAllByLabelText('删除')).toHaveLength(6)
  })

  it('④ 欠款总览：共欠你/欠主代理合计 + 逐客户行 + 底部逾期未付分期一行', () => {
    const { container } = renderPage()
    expect(screen.getByText('欠款总览')).toBeInTheDocument()
    const tot = screen.getByText(/共欠你/)
    expect(tot.textContent).toContain('AUD 196,601.09')
    expect(tot.textContent).toContain('欠主代理 AUD 0.00')
    expect(screen.getByText('吕列隆')).toBeInTheDocument()
    expect(screen.getByText('AUD 190,000.09')).toBeInTheDocument()
    expect(container.textContent).toContain('逾期未付分期：无')
  })

  it('④ 逾期未付分期 N>0 → 折进欠款总览底行「N 笔」', () => {
    setDash({
      overdueInstallments: [
        { installmentId: 'i1', customerId: 'cu6', caseId: 'k9', customerName: '吕列隆', amount: 100, daysOverdue: 3 },
        { installmentId: 'i2', customerId: 'cu7', caseId: 'k8', customerName: '何祥龙', amount: 200, daysOverdue: 9 },
      ],
    })
    const { container } = renderPage()
    expect(container.textContent).toContain('逾期未付分期：2 笔')
  })

  it('⑤ 官方签证处理时间：新标签打开 immi.homeaffairs.gov.au', () => {
    renderPage()
    const a = screen.getByRole('link', { name: /官方签证处理时间/ })
    expect(a).toHaveAttribute('target', '_blank')
    expect(a.getAttribute('href')).toContain('immi.homeaffairs.gov.au')
  })

  it('临近到期有数据：摘要计数含 TRT，条内显示客户名', () => {
    setDash({
      expiringDocItems: [
        { id: 'e1', customerId: 'cu1', customerName: '王璞', label: '护照 · 30 天', daysRemaining: 30, status: 'soon', tone: 'amber', ic: 'passport' },
      ],
      trtReminders: [
        { caseId: 'k3', customerId: 'cu3', customerName: '孙佳琪', monthsSinceGrant: 25 },
      ],
    })
    const { container } = renderPage()
    expect(container.querySelector('header p')?.textContent).toContain('临近到期 2 个')
    expect(screen.queryByText(/近 30 天无临近到期/)).toBeNull()
    expect(screen.getByText(/护照 · 30 天/)).toBeInTheDocument()
    expect(screen.getByText(/186 TRT 可办/)).toBeInTheDocument()
  })

  it('旧块全部移除：月度趋势柱图 / 星标客户 / 逾期未付款大卡 / 递交进度表 / 独立到期卡', () => {
    renderPage()
    expect(screen.queryByText('月度收款趋势')).toBeNull()
    expect(screen.queryByText('星标客户')).toBeNull()
    expect(screen.queryByText('逾期未付款')).toBeNull()
    expect(screen.queryByText('递交进度')).toBeNull()
    expect(screen.queryByText('即将到期提醒')).toBeNull()
    expect(screen.queryByText('打开案件表')).toBeNull()
  })

  it('空数据：各块空态、不报错、不出假数字', () => {
    setDash({
      activeCaseCount: 0,
      stageDistribution: [],
      todoCases: [],
      thisMonthReceipts: 0,
      debtTotals: { clientOwesTotal: 0, companyOwesTotal: 0 },
      customerDebts: [],
    })
    setChecklist({ items: [], openCount: 0 })
    const { container } = renderPage()
    expect(screen.getByText('暂无在办案件')).toBeInTheDocument()
    expect(screen.getByText('暂无待办阶段案件')).toBeInTheDocument()
    expect(screen.getByText('无未结欠款')).toBeInTheDocument()
    expect(screen.getByText(/近 30 天无临近到期/)).toBeInTheDocument()
    expect(container.textContent).toContain('逾期未付分期：无')
    expect(screen.queryByText(/\d+ 户欠款/)).toBeNull() // 0 户不显示角标
    expect(screen.getAllByText('0.00').length).toBeGreaterThan(0)
  })
})
