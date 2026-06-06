import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthContext } from '../../providers/auth-context'
import type { AuthContextValue } from '../../providers/auth-context'
import type { Case, CaseStageHistory, Customer } from '../../types/models'

// 客户本体；其余查询无网络(retry:false) → 优雅空态
vi.mock('../../api/customers', async (orig) => {
  const actual = await orig<typeof import('../../api/customers')>()
  return {
    ...actual,
    getCustomer: vi.fn().mockResolvedValue({
      id: 'cu1', full_name: '测试客户', primary_applicant_id: null, client_source: null,
      is_starred: false, is_archived: false, gender: 'male', sponsor_employer_id: null,
      sponsor_position: null, referrer_id: null, birth_date: null, notes: null, phone: null, email: null,
    } as unknown as Customer),
    listCustomers: vi.fn().mockResolvedValue([]),
  }
})

// 案件读取：页面用全量 listCases + listAllCaseApplicants（拥有∪参与），默认无案件，按测试覆盖
vi.mock('../../api/cases', async (orig) => {
  const actual = await orig<typeof import('../../api/cases')>()
  return {
    ...actual,
    listCases: vi.fn().mockResolvedValue([]),
    getCaseStageHistory: vi.fn().mockResolvedValue([]), // 概要带「审理时间」格读真实递交日；测试给空 → 该格不显示
  }
})
vi.mock('../../api/caseApplicants', async (orig) => {
  const actual = await orig<typeof import('../../api/caseApplicants')>()
  return {
    ...actual,
    listAllCaseApplicants: vi.fn().mockResolvedValue([]),
    listCaseApplicants: vi.fn().mockResolvedValue([]),
  }
})
// 归属人名字解析（概要带「归属人」格经 useReferrer → getReferrer）
vi.mock('../../api/referrers', async (orig) => {
  const actual = await orig<typeof import('../../api/referrers')>()
  return {
    ...actual,
    getReferrer: vi.fn().mockResolvedValue(null),
    listReferrers: vi.fn().mockResolvedValue([]),
  }
})

import { CustomerDetailPage } from './CustomerDetailPage'
import { getCaseStageHistory, listCases } from '../../api/cases'
import { getCustomer, listCustomers } from '../../api/customers'
import { getReferrer } from '../../api/referrers'
import { listAllCaseApplicants, listCaseApplicants } from '../../api/caseApplicants'
import { queryKeys } from '../../hooks/queries/keys'

const mkCase = (o: Partial<Case>): Case => ({
  id: 'ca1', case_number: '12345678', customer_id: 'cu1', visa_subclass: '482', visa_stream: 'Core Skill', case_category: null,
  destination_country: null, sponsor_position: null, sponsor_employer_id: null,
  current_stage: 'nomination_lodged', currency: 'AUD', sync_tracking: true,
  trt_reminder_enabled: false, parent_case_id: null, parent_sync_progress: false, assigned_to: null,
  created_by: null, is_archived: false, created_at: '', updated_at: '', ...o,
})

const mkAuth = (isAdmin: boolean) =>
  ({
    user: { id: 'u1' }, loading: false, session: null, profile: null, isAdmin,
    signIn: async () => {}, signOut: async () => {},
  }) as unknown as AuthContextValue
const authValue = mkAuth(true)

function renderPage(entry = '/customers/cu1', auth: AuthContextValue = authValue) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, refetchOnMount: false } } })
  // 费用卡加载门的查询（无网络，确定性）：付款计划/付款/款项 + 家庭关联 + 本案发票
  qc.setQueryData(queryKeys.dashboard.plans, [])
  qc.setQueryData(queryKeys.dashboard.payments, [])
  qc.setQueryData(queryKeys.dashboard.planItems, [])
  qc.setQueryData(queryKeys.familyLinks.all, [])
  qc.setQueryData(queryKeys.documents.byCase('ca1'), [])
  qc.setQueryData(queryKeys.documents.byCase('caA'), [])
  return render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="/customers/:id" element={<CustomerDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(listCases).mockResolvedValue([])
  vi.mocked(listCustomers).mockResolvedValue([])
  vi.mocked(listAllCaseApplicants).mockResolvedValue([])
  vi.mocked(listCaseApplicants).mockResolvedValue([])
  vi.mocked(getCaseStageHistory).mockResolvedValue([])
})

describe('CustomerDetailPage（案件中心单页 · 无 tab）', () => {
  it('概要带「归属人」格：有归属人 → 解析显示名字；无 → —', async () => {
    vi.mocked(getCustomer).mockResolvedValueOnce({
      id: 'cu1', full_name: '测试客户', primary_applicant_id: null, client_source: null,
      is_starred: false, is_archived: false, gender: 'male', sponsor_employer_id: null,
      sponsor_position: null, referrer_id: null, owner_referrer_id: 'o1',
      birth_date: null, notes: null, phone: null, email: null,
    } as unknown as Customer)
    vi.mocked(getReferrer).mockResolvedValue({
      id: 'o1', name: '刘祎', kind: 'owner', contact_phone: null, contact_email: null,
      notes: null, is_archived: false, created_by: null, created_at: '', updated_at: '',
    } as unknown as Awaited<ReturnType<typeof getReferrer>>)
    renderPage()
    expect(await screen.findByText('归属人')).toBeInTheDocument()
    expect(await screen.findByText('刘祎')).toBeInTheDocument()
  })

  // 0031 起彻底删除全员开放（两位用户均 staff，2026-06 拍板）；防误删靠红色确认弹窗
  it('staff 也能看到客户「彻底删除」与案件「彻底删除本案」（0031 全员开放）', async () => {
    vi.mocked(listCases).mockResolvedValue([mkCase({})])
    renderPage('/customers/cu1', mkAuth(false))
    expect((await screen.findAllByText('测试客户')).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: '归档' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '彻底删除' })).toBeInTheDocument()
    expect(screen.getByText('彻底删除本案')).toBeInTheDocument()
    expect(screen.getByText('归档本案')).toBeInTheDocument()
  })

  it('概要带：姓名 + 参与案件格 + 编辑客户；无主/副申、无所属组、不再有任何 tab', async () => {
    renderPage()
    expect((await screen.findAllByText('测试客户')).length).toBeGreaterThan(0)
    expect(screen.queryByText('主申请人')).not.toBeInTheDocument() // 去角色：不再标主/副申
    // 一案一组：概要带不再显示「所属组」，改「参与案件 N 件」（链到案件参与管理）
    expect(screen.getByText('参与案件')).toBeInTheDocument()
    expect(screen.getByText(/^\d+ 件$/)).toBeInTheDocument()
    expect(screen.queryByText('所属组 Group')).not.toBeInTheDocument()
    // 性别·生日格（客户属性放进概要带）；gender=male → 男，birth_date 空则无日期
    expect(screen.getByText('性别 · 生日')).toBeInTheDocument()
    expect(screen.getByText('男')).toBeInTheDocument()
    expect(screen.getByText('编辑客户')).toBeInTheDocument()
    // 旧 tab 全部消失
    for (const t of ['概览', '案件 / 家庭成员', '付款', '文件', '记录']) {
      expect(screen.queryByRole('button', { name: t })).not.toBeInTheDocument()
    }
  })

  it('概要带「审理时间」：阶段=提名递交且有真实递交历史 → 提名审理时间 · 已 N 天', async () => {
    vi.mocked(listCases).mockResolvedValue([mkCase({ id: 'ca1', current_stage: 'nomination_lodged' })])
    vi.mocked(getCaseStageHistory).mockResolvedValue([
      {
        id: 'h1', case_id: 'ca1', from_stage: 'todo', to_stage: 'nomination_lodged', note: null,
        changed_by: null, changed_at: '2026-05-01T00:00:00Z', effective_at: '2026-05-01T00:00:00Z',
      } as CaseStageHistory,
    ])
    renderPage()
    expect(await screen.findByText('审理时间')).toBeInTheDocument()
    expect(screen.getByText('提名审理时间')).toBeInTheDocument()
    expect(screen.getByText(/^已 \d+ 天$/)).toBeInTheDocument()
  })

  it('概要带「审理时间」：其它阶段（如下签）→ 此格不显示；无递交历史也不显示', async () => {
    vi.mocked(listCases).mockResolvedValue([mkCase({ id: 'ca1', current_stage: 'granted' })])
    renderPage()
    expect((await screen.findAllByText('测试客户')).length).toBeGreaterThan(0)
    expect(screen.queryByText('审理时间')).not.toBeInTheDocument()
    expect(screen.queryByText(/^已 \d+ 天$/)).not.toBeInTheDocument()
  })

  it('两张主卡：相关案件 + 费用记录；无案件时空态不崩', async () => {
    renderPage()
    await screen.findAllByText('测试客户')
    expect(screen.getByText('相关案件')).toBeInTheDocument()
    expect(screen.getByText('费用记录')).toBeInTheDocument()
    expect(screen.getByText(/暂无案件 · 点右上/)).toBeInTheDocument() // 相关案件空态
    expect(screen.getByText('暂无案件')).toBeInTheDocument() // 概要带当前案件格
  })

  it('底部归档 / 彻底删除常驻', async () => {
    renderPage()
    await screen.findAllByText('测试客户')
    expect(screen.getByText('归档')).toBeInTheDocument()
    expect(screen.getByText('彻底删除')).toBeInTheDocument()
  })

  it('有案件时：案件 tab 渲染，且概要带「案件·阶段」格列出每个案件的阶段（多案全列、可点切换）', async () => {
    vi.mocked(listCases).mockResolvedValue([
      mkCase({ id: 'ca1', visa_subclass: '482', visa_stream: 'Core Skill', current_stage: 'nomination_lodged' }),
      mkCase({ id: 'ca2', visa_subclass: '500', visa_stream: null, current_stage: 'granted', created_at: '2026-02-01' }),
    ])
    renderPage()
    await screen.findAllByText('测试客户')
    // 案件 tab（相关案件卡内）
    expect(await screen.findByRole('button', { name: '482/Core Skill' })).toBeInTheDocument()
    // 概要带「案件 · 阶段」格：两个案件的 visa + 阶段徽章**都**列出
    const bandCell = screen.getByText('案件 · 阶段').parentElement as HTMLElement
    expect(within(bandCell).getByText('482/Core Skill')).toBeInTheDocument()
    expect(within(bandCell).getByText('500')).toBeInTheDocument()
    expect(within(bandCell).getByText('提名递交')).toBeInTheDocument()
    expect(within(bandCell).getByText('下签')).toBeInTheDocument()
    expect(within(bandCell).getByText('点击切换当前案件')).toBeInTheDocument()
    // 案件卡不再有「主申请人 / 副申请人」行
    expect(screen.getByText('签证子类别')).toBeInTheDocument()
    expect(screen.queryByText('副申请人')).not.toBeInTheDocument()
    // 编辑案件直达表单；「打开案件页」已随案件详情页删除
    expect(screen.getByRole('link', { name: '编辑案件 ›' })).toHaveAttribute('href', '/cases/ca1/edit')
    expect(screen.queryByText(/打开案件页/)).not.toBeInTheDocument()
    // 本案 Group 组码（与案件页/案件表同码）+ 案件级 归档/删除收进「⋯」菜单（与客户级底部操作分开）
    expect(screen.getByText('Group 组码')).toBeInTheDocument()
    expect(screen.getByText(/^G-[0-9A-Z]{4}$/)).toBeInTheDocument()
    expect(screen.getByLabelText('本案更多操作')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /归档本案/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /彻底删除本案/ })).toBeInTheDocument()
  })

  // 案件详情显示「案件大类」：cases.case_category（四值枚举，可空）
  it('本案信息显示「案件大类」（如 签证申请）', async () => {
    vi.mocked(listCases).mockResolvedValue([
      mkCase({ id: 'ca1', visa_subclass: '482', visa_stream: 'Core Skill', case_category: '签证申请' } as Partial<Case>),
    ])
    renderPage()
    await screen.findAllByText('测试客户')
    expect(await screen.findByText('案件大类')).toBeInTheDocument()
    expect(screen.getByText('签证申请')).toBeInTheDocument()
  })

  it('未填案件大类（旧数据 null）：「案件大类」行退「—」，不报错', async () => {
    vi.mocked(listCases).mockResolvedValue([
      mkCase({ id: 'ca1', visa_subclass: '482', visa_stream: null }),
    ])
    renderPage()
    await screen.findAllByText('测试客户')
    expect(await screen.findByText('案件大类')).toBeInTheDocument()
    expect(screen.queryByText('签证申请')).toBeNull()
  })

  // 案件详情显示「签证大类」：取值 = 该案签证所属目录大类（VISA_CATALOG 枚举，零新逻辑）
  // 命名：案件大类(case_category·手选) / 签证大类(目录派生) / 签证子类别——三行各司其职
  it('本案信息显示「签证大类」= 签证所属目录大类（如 482 → 工作 / 雇主担保）', async () => {
    vi.mocked(listCases).mockResolvedValue([
      mkCase({ id: 'ca1', visa_subclass: '482', visa_stream: 'Core Skill', current_stage: 'nomination_lodged' }),
    ])
    renderPage()
    await screen.findAllByText('测试客户')
    expect(await screen.findByText('签证大类')).toBeInTheDocument()
    expect(screen.getByText('工作 / 雇主担保')).toBeInTheDocument()
    expect(screen.queryByText('签证类别')).toBeNull() // 旧称谓不再出现
  })

  it('目录外手填签证（如 887）：「签证大类」行退「—」，不报错', async () => {
    vi.mocked(listCases).mockResolvedValue([
      mkCase({ id: 'ca1', visa_subclass: '887', visa_stream: null, current_stage: 'todo' }),
    ])
    renderPage()
    await screen.findAllByText('测试客户')
    expect(await screen.findByText('签证大类')).toBeInTheDocument()
    expect(screen.queryByText('工作 / 雇主担保')).toBeNull()
  })

  it('费用记录卡标题带案件号 tag + 客户侧应收合计贴底（纯应收视图）', async () => {
    vi.mocked(listCases).mockResolvedValue([mkCase({ id: 'ca1', visa_subclass: '482' })])
    renderPage()
    await screen.findAllByText('测试客户')
    expect(await screen.findByText('应收合计')).toBeInTheDocument()
    expect(screen.queryByText('本案净额')).not.toBeInTheDocument()
  })

  it('参与的案件：出现在参与人页面（无归属/主导标注）、平铺参与客户、阶段可推进', async () => {
    const alice = { id: 'al1', full_name: 'Alice', primary_applicant_id: null, is_archived: false } as unknown as Customer
    const part = { id: 'x1', case_id: 'caA', customer_id: 'cu1', created_at: '' }
    vi.mocked(listCustomers).mockResolvedValue([alice])
    vi.mocked(listCases).mockResolvedValue([mkCase({ id: 'caA', customer_id: 'al1', visa_subclass: '482', visa_stream: null })])
    vi.mocked(listAllCaseApplicants).mockResolvedValue([part] as never)
    vi.mocked(listCaseApplicants).mockResolvedValue([part] as never)
    renderPage()
    await screen.findAllByText('测试客户')
    // 参与的案件出现在 tab，且**不再标注归属人**（没有谁主导一说）
    expect(await screen.findByRole('button', { name: '482' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /482.*Alice/ })).not.toBeInTheDocument()
    // 以案件为组：参与人完全平级（无案件客户标注）——名字挂链接跳各自客户页；✕ 只在本页客户自己的 chip
    expect(screen.getByText('参与客户')).toBeInTheDocument()
    const ownerLink = await screen.findByRole('link', { name: 'Alice' })
    expect(ownerLink).toHaveAttribute('href', '/customers/al1') // 参与人名字 → 各自客户页
    expect(screen.queryByText(/案件客户/)).not.toBeInTheDocument() // 无特殊标注，参与人平级
    expect(screen.getByLabelText('移出 测试客户')).toBeInTheDocument() // 本页客户自己可移出
    expect(screen.queryByLabelText('移出 Alice')).not.toBeInTheDocument() // 别人的不能移
    expect(screen.getByRole('button', { name: '+ 添加参与人' })).toBeInTheDocument()
    expect(screen.getByText('· 全员进度一致')).toBeInTheDocument()
    // 参与人页面同样可推进阶段：与案件页同一「阶段进展」卡（推进阶段 → 展开 StageControl）
    expect(screen.getByText('阶段进展')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '推进阶段 →' }))
    expect(screen.getByRole('button', { name: /更新阶段/ })).toBeInTheDocument()
    expect(screen.queryByText(/进度同步自主案件/)).not.toBeInTheDocument()
  })

  it('?case= 直达：URL 带 case 参数 → 自动选中该案件（全站案件链接的落点）', async () => {
    vi.mocked(listCases).mockResolvedValue([
      mkCase({ id: 'ca1', visa_subclass: '482', visa_stream: 'Core Skill' }),
      mkCase({ id: 'ca2', visa_subclass: '500', visa_stream: null, created_at: '2026-02-01' }),
    ])
    renderPage('/customers/cu1?case=ca2')
    await screen.findAllByText('测试客户')
    // 选中的是 ca2（500）：编辑案件链接指向 ca2
    expect(await screen.findByRole('link', { name: '编辑案件 ›' })).toHaveAttribute('href', '/cases/ca2/edit')
  })

  it('客户页无「同步主案件」锁定：即使案件设了 parent_sync_progress，进度照样可编辑', async () => {
    vi.mocked(listCases).mockResolvedValue([
      mkCase({ id: 'ca1', parent_case_id: 'caP', parent_sync_progress: true }), // 旧「进度同步」子案
    ])
    renderPage()
    await screen.findAllByText('测试客户')
    expect(screen.queryByText(/进度同步自主案件/)).not.toBeInTheDocument()
    // 展开推进阶段 → StageControl 可操作（非禁用）
    fireEvent.click(screen.getByRole('button', { name: '推进阶段 →' }))
    expect(screen.getByRole('button', { name: /更新阶段/ })).toBeInTheDocument()
    expect(screen.getByRole('combobox')).not.toBeDisabled()
  })
})
