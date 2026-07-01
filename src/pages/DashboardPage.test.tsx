import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
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

const looseItem = (id: string, content: string) => ({
  id, content, is_done: false, customer_id: null, case_id: null,
  created_by: null, created_at: '', updated_at: '',
})

function setDash(over: Record<string, unknown> = {}) {
  dash.data = {
    isPending: false, isError: false,
    activeCaseCount: 27,
    categoryDistribution: [
      { category: 'todo', label: '待办/未开始', count: 5, color: '#7c6fd6' },
      { category: 'waiting', label: '等待外部', count: 1, color: '#3f7cb5' },
      { category: 'inProgress', label: '进行中/已递交', count: 20, color: '#7e887e' },
      { category: 'action', label: '需要行动', count: 1, color: '#c08a2e' },
      { category: 'done', label: '完成/获批', count: 12, color: '#357a52' },
    ],
    grantedCount: 10,
    // 需要行动案件（主角左栏顶部）
    actionCases: [
      { caseId: 'act1', customerId: 'cu1', customerName: '黄玉婷', participants: [{ id: 'cu1', name: '黄玉婷' }], visaLabel: '482 · 补件材料', stage: 'docs_requested', stageLabel: '补件' },
    ],
    todoCases: [
      { caseId: 'k1', customerId: 'cu1', customerName: '测试2222222', participants: [{ id: 'cu1', name: '测试2222222' }], visaLabel: '494', stage: 'todo', stageLabel: '待办' },
      { caseId: 'k2', customerId: 'cu2', customerName: '测试1111111', participants: [{ id: 'cu2', name: '测试1111111' }], visaLabel: '186', stage: 'drafted', stageLabel: '已草拟' },
      { caseId: 'k3', customerId: 'cu3', customerName: '王璞', participants: [{ id: 'cu3', name: '王璞' }, { id: 'cu5', name: '孙佳琪' }], visaLabel: '482', stage: 'todo', stageLabel: '待办' },
      { caseId: 'k4', customerId: 'cu4', customerName: '邓韬（Dylan）', participants: [{ id: 'cu4', name: '邓韬（Dylan）' }], visaLabel: '482 · Subsequent Entrant', stage: 'drafted', stageLabel: '已草拟' },
      { caseId: 'k5', customerId: 'cu5', customerName: '孙佳琪', participants: [{ id: 'cu5', name: '孙佳琪' }], visaLabel: '186 · Direct Entry', stage: 'todo', stageLabel: '待办' },
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
    cohabReminders: [],
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

describe('DashboardPage · 概览主次重设计（主角 + 配角）', () => {
  it('① 顶栏：衬线问候 + 摘要（待办/临近到期/本月已收）+ 新建客户（无搜索条/铃铛）', () => {
    const { container } = renderPage()
    const h = screen.getByRole('heading', { name: /你好/ })
    expect(h.className).toContain('font-serif')
    const sub = container.querySelector('header p')
    expect(sub?.textContent).toContain('待办 8')
    expect(sub?.textContent).toContain('临近到期 0')
    expect(sub?.textContent).toContain('本月已收 AUD 114.00')
    expect(screen.getByRole('link', { name: /新建客户/ })).toHaveAttribute('href', '/customers/new')
    expect(screen.queryByText(/搜索客户 \/ 案件 \/ 参考号/)).toBeNull()
    expect(screen.queryByLabelText('通知')).toBeNull()
  })

  it('② 主角「今天要处理」：标题 18px + 计数 = 需要行动案件 + 未完成待办', () => {
    renderPage()
    const hero = screen.getByRole('heading', { name: /今天要处理/ })
    expect(hero.className).toContain('text-[18px]')
    // todayCount = actionCases(1) + openCount(8) = 9
    expect(hero.textContent).toContain('9')
    expect(screen.getByText(/待办 & 需要行动/)).toBeInTheDocument()
  })

  it('② 需要行动案件：取数=当前阶段为 action 的案件，「需要行动」标签 + 跳该案', () => {
    renderPage()
    expect(screen.getByText('黄玉婷')).toBeInTheDocument()
    const row = screen.getByText('黄玉婷').closest('a')!
    expect(row.getAttribute('href')).toBe('/customers/cu1?case=act1')
    expect(row.textContent).toContain('需要行动')
  })

  it('② 待办清单（嵌入主角·输入在底部）：输入框 + 添加 + 逐条待办（随手记 + ✕）', () => {
    renderPage()
    expect(screen.getByPlaceholderText(/写一句待办/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '添加' })).toBeInTheDocument()
    expect(screen.getByText('2026/6/1 Guoywfan 提名')).toBeInTheDocument()
    expect(screen.getAllByText('随手记')).toHaveLength(6)
    expect(screen.getAllByLabelText('删除')).toHaveLength(6)
  })

  it('② 临近到期空态：近 30 天无临近到期', () => {
    renderPage()
    expect(screen.getByText(/近 30 天无临近到期/)).toBeInTheDocument()
  })

  it('② 临近到期有数据：合并 文档 + TRT + 同居，紧急度分色（≤7 红 / 8–14 黄 / 15–30 绿）', () => {
    setDash({
      expiringDocItems: [
        { id: 'e1', customerId: 'cu1', customerName: '杨文超', label: 'SBS 核查', daysRemaining: 3, status: 'soon', tone: 'rose', ic: 'doc' }, // 红
        { id: 'e2', customerId: 'cu2', customerName: '何祥龙', label: '护照', daysRemaining: 10, status: 'soon', tone: 'amber', ic: 'passport' }, // 黄
        { id: 'e3', customerId: 'cu3', customerName: '李娜', label: '体检', daysRemaining: 25, status: 'soon', tone: 'amber', ic: 'doc' }, // 绿
      ],
      trtReminders: [{ caseId: 'k3', customerId: 'cu3', customerName: '孙佳琪', monthsSinceGrant: 25 }],
      cohabReminders: [{ caseId: 'k9', customerId: 'cu9', customerName: '刘亚雯', caseNumber: 'C9', monthsSince: 4 }],
    })
    const { container } = renderPage()
    // 摘要计数 = 3 文档 + 1 TRT + 1 同居 = 5
    expect(container.querySelector('header p')?.textContent).toContain('临近到期 5')
    expect(screen.queryByText(/近 30 天无临近到期/)).toBeNull()
    // 分色：3 天红条 / 10 天黄条 / 25 天绿条
    const red = screen.getByText('SBS 核查').closest('a')!
    expect(red.innerHTML).toContain('bg-rose-400')
    const amber = screen.getByText('护照').closest('a')!
    expect(amber.innerHTML).toContain('bg-amber-400')
    const green = screen.getByText('体检').closest('a')!
    expect(green.innerHTML).toContain('bg-emerald-400')
    // TRT / 同居进列表，同居链到该客户并选中该案
    expect(screen.getByText(/186 TRT 可办/)).toBeInTheDocument()
    const cohab = screen.getByText('更新同居材料').closest('a')!
    expect(cohab.getAttribute('href')).toBe('/customers/cu9?case=k9')
  })

  it('③ 案件进展（配角）：在办/已下签小字 + 类别图例 + 全部案件链 + 环心在办数', () => {
    renderPage()
    expect(screen.getByText('案件进展')).toBeInTheDocument()
    expect(screen.getByText('在办 27 · 已下签 10')).toBeInTheDocument()
    const progress = screen.getByText('案件进展').closest('section')!
    for (const [label, count] of [['待办/未开始', 5], ['等待外部', 1], ['进行中/已递交', 20], ['需要行动', 1], ['完成/获批', 12]] as const) {
      const row = within(progress).getByText(label).closest('div')!
      expect(row.textContent).toContain(String(count))
    }
    expect(screen.getByRole('link', { name: /全部案件/ })).toHaveAttribute('href', '/cases')
    expect(screen.getAllByText('27').length).toBeGreaterThan(0) // 环心
  })

  it('③ 钱（配角）：本月收款 114.00（绿）+ 客户欠款总额 196,601.09（珊瑚）+ 3 户欠款角标 + 链财务', () => {
    renderPage()
    expect(screen.getByText('本月收款')).toBeInTheDocument()
    expect(screen.getByText('客户欠款总额')).toBeInTheDocument()
    expect(screen.getByText('114.00')).toBeInTheDocument()
    expect(screen.getByText('196,601.09')).toBeInTheDocument()
    expect(screen.getByText('3 户欠款')).toBeInTheDocument()
    expect(screen.getAllByRole('link').filter((a) => a.getAttribute('href') === '/finance').length).toBeGreaterThan(0)
  })

  it('④ 待办 / 已草拟 案件 chips：参与人 + 类型；阶段标签不在 chip 重复', () => {
    renderPage()
    expect(screen.getByText('待办 / 已草拟 案件')).toBeInTheDocument()
    expect(screen.getByText('测试2222222')).toBeInTheDocument()
    expect(screen.getByText('邓韬（Dylan）')).toBeInTheDocument()
    expect(screen.getByText('482 · Subsequent Entrant')).toBeInTheDocument()
    // k3 两名参与人都显示，孙佳琪在 k3 + k5 自己的行出现 ≥2 次
    expect(screen.getAllByText('孙佳琪').length).toBeGreaterThanOrEqual(2)
  })

  it('④ 待办 / 已草拟 案件全部列出（chips 不截断）', () => {
    setDash({
      actionCases: [],
      todoCases: Array.from({ length: 8 }, (_, i) => ({
        caseId: `k${i}`, customerId: `cu${i}`, customerName: `待办客户${i}`,
        participants: [{ id: `cu${i}`, name: `待办客户${i}` }], visaLabel: '482',
        stage: i % 2 === 0 ? 'todo' : 'drafted', stageLabel: i % 2 === 0 ? '待办' : '已草拟',
      })),
    })
    renderPage()
    expect(screen.getByText('待办客户5')).toBeInTheDocument()
    expect(screen.getByText('待办客户6')).toBeInTheDocument()
    expect(screen.getByText('待办客户7')).toBeInTheDocument()
  })

  it('⑤ 官方签证处理时间：底部窄条，新标签打开 immi.homeaffairs.gov.au', () => {
    renderPage()
    const a = screen.getByRole('link', { name: /官方签证处理时间/ })
    expect(a).toHaveAttribute('target', '_blank')
    expect(a.getAttribute('href')).toContain('immi.homeaffairs.gov.au')
  })

  it('⑤ 顺序：待办 / 已草拟 chips 在「官方签证处理时间」之前（官方时间垫底）', () => {
    renderPage()
    const todo = screen.getByText('待办 / 已草拟 案件')
    const official = screen.getByRole('link', { name: /官方签证处理时间/ })
    // todo 在 official 之前 → todo 相对 official 为 PRECEDING(2)
    expect(official.compareDocumentPosition(todo) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
  })

  it('响应式：主角两栏 + 配角两栏都带「窄屏单列 / 宽屏多列」类（不横向滚动）', () => {
    const { container } = renderPage()
    // 主角两栏：grid-cols-1 lg:grid-cols-[1.25fr_1fr]
    expect(container.querySelector('.lg\\:grid-cols-\\[1\\.25fr_1fr\\]')).not.toBeNull()
    // 配角两栏：grid-cols-1 md:grid-cols-2
    expect(container.querySelector('.md\\:grid-cols-2')).not.toBeNull()
  })

  it('旧块全部移除：KPI 四卡 / 欠款总览列表 / 逾期分期 / 月度趋势 / 星标 / 递交表', () => {
    renderPage()
    expect(screen.queryByText('待办事项')).toBeNull() // 旧 KPI 卡标签
    expect(screen.queryByText('欠款总览')).toBeNull()
    expect(screen.queryByText(/逾期未付分期/)).toBeNull()
    expect(screen.queryByText('月度收款趋势')).toBeNull()
    expect(screen.queryByText('星标客户')).toBeNull()
    expect(screen.queryByText('递交进度')).toBeNull()
    expect(screen.queryByText('即将到期提醒')).toBeNull()
  })

  it('空数据：各块空态、不报错、不出假数字、0 户不显示角标', () => {
    setDash({
      activeCaseCount: 0,
      categoryDistribution: [],
      grantedCount: 0,
      actionCases: [],
      todoCases: [],
      thisMonthReceipts: 0,
      debtTotals: { clientOwesTotal: 0, companyOwesTotal: 0 },
      customerDebts: [],
    })
    setChecklist({ items: [], openCount: 0 })
    renderPage()
    expect(screen.getByText('暂无在办案件')).toBeInTheDocument()
    expect(screen.getByText('暂无待办 / 已草拟 案件')).toBeInTheDocument()
    expect(screen.getByText(/近 30 天无临近到期/)).toBeInTheDocument()
    expect(screen.queryByText(/\d+ 户欠款/)).toBeNull()
    expect(screen.getAllByText('0.00').length).toBeGreaterThan(0)
  })
})
