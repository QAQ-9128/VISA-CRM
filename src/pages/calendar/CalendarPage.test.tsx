import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { queryKeys } from '../../hooks/queries/keys'
import { NAV_ITEMS } from '../../components/layout/navItems'
import { AuthContext } from '../../providers/auth-context'
import type { AuthContextValue } from '../../providers/auth-context'
import type { Case, CaseReminder, CaseStageHistory, Customer, RecordRow } from '../../types/models'

const navigateSpy = vi.fn()
vi.mock('react-router-dom', async (orig) => {
  const m = await orig<typeof import('react-router-dom')>()
  return { ...m, useNavigate: () => navigateSpy }
})
// 固定「今天」=2026-06-16、默认月=2026-06（mock 不影响 calendarGrid 自带的本地格式化）
vi.mock('../../lib/dateRules', async (orig) => {
  const m = await orig<typeof import('../../lib/dateRules')>()
  return { ...m, todayYmd: () => '2026-06-16' }
})
vi.mock('../../lib/month', async (orig) => {
  const m = await orig<typeof import('../../lib/month')>()
  return { ...m, currentMonth: () => '2026-06' }
})

import { CalendarPage } from './CalendarPage'

const mkCust = (o: Partial<Customer>): Customer => ({
  id: 'P', full_name: '谢华', chinese_name: '谢华', english_name: null, birth_date: null, gender: null,
  passport_no: null, nationality: null, phone: null, email: null, wechat: null, address: null,
  sponsor_employer_id: null, sponsor_position: null, referrer_id: null, owner_referrer_id: null,
  primary_applicant_id: null, relationship_to_primary: null, client_source: null, is_starred: false,
  notes: null, assigned_to: null, created_by: null, is_archived: false, created_at: '', updated_at: '', ...o,
})
const mkCase = (o: Partial<Case>): Case => ({
  id: 'ca1', case_number: '99710250', customer_id: 'P', visa_subclass: '482', visa_stream: 'Core Skills',
  case_category: null, case_details: null, destination_country: null, sponsor_position: null, sponsor_employer_id: null,
  immi_account_id: null, current_stage: 'granted', currency: 'AUD', sync_tracking: true,
  trt_reminder_enabled: false, trt_reminder_dismissed: false, cohab_reminder_enabled: false, cohab_reminder_last: null,
  parent_case_id: null, parent_sync_progress: false, assigned_to: null, created_by: null, is_archived: false,
  created_at: '', updated_at: '', ...o,
})
const mkHist = (o: Partial<CaseStageHistory>): CaseStageHistory => ({
  id: 'h', case_id: 'ca1', from_stage: null, to_stage: 'nomination_lodged', note: null, changed_by: null,
  changed_at: '2026-06-01T00:00:00Z', effective_at: '2026-06-01', ...o,
} as CaseStageHistory)
const mkTask = (o: Partial<RecordRow>): RecordRow => ({
  id: 't', customer_id: 'P', case_id: 'ca1', type: 'task', content: '补件', due_date: '2026-06-16',
  is_done: false, done_at: null, assigned_to: null, channel: null, emoji_marker: null, created_by: null,
  created_at: '', updated_at: '', ...o,
} as RecordRow)
const mkRem = (o: Partial<CaseReminder>): CaseReminder => ({
  id: 'r1', case_id: 'ca1', content: '办 186 TRT', base_date: '2026-06-16', offset_value: 0, offset_unit: 'day',
  repeat_rule: 'never', enabled: true, created_by: null, created_at: '2026-06-16', ...o,
} as CaseReminder)

function renderPage(over?: { history?: CaseStageHistory[]; tasks?: RecordRow[]; reminders?: CaseReminder[] }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity, refetchOnMount: false } },
  })
  const seed = (k: readonly unknown[], d: unknown) => qc.setQueryData(k, d)
  seed(queryKeys.cases.list, [mkCase({})])
  seed(queryKeys.customers.list({}), [mkCust({})])
  seed(queryKeys.caseApplicants.all, [])
  seed(queryKeys.cases.stageHistoryAll, over?.history ?? [
    mkHist({ id: 'h1', to_stage: 'nomination_lodged', effective_at: '2026-06-03' }),
    mkHist({ id: 'h2', to_stage: 'granted', effective_at: '2026-06-20' }),
  ])
  seed(queryKeys.records.open, over?.tasks ?? [])
  seed(queryKeys.reminders.all, over?.reminders ?? [])
  const authValue = { user: { id: 'u1' }, loading: false, session: null, profile: null, isAdmin: true, signIn: async () => {}, signOut: async () => {} } as unknown as AuthContextValue
  return render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter>
          <CalendarPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

beforeEach(() => navigateSpy.mockClear())

describe('侧边栏入口', () => {
  it('NAV_ITEMS 含「日历」→ /calendar，放在「递交进度」之后', () => {
    const cal = NAV_ITEMS.find((n) => n.label === '日历')
    expect(cal?.to).toBe('/calendar')
    const casesIdx = NAV_ITEMS.findIndex((n) => n.to === '/cases')
    const calIdx = NAV_ITEMS.findIndex((n) => n.to === '/calendar')
    expect(calIdx).toBe(casesIdx + 1)
  })
})

describe('CalendarPage·Google 风（顶栏 + 彩条 + 三视图）', () => {
  it('月视图：今天(6/16)绿底高亮；事件=彩条（左色条按类型），只标单点不画跨度', () => {
    renderPage()
    expect(screen.getByText('案件日历')).toBeInTheDocument()
    expect(screen.getByText('16').className).toContain('bg-emerald-600')
    // 提名递交=灰条、下签=绿条（颜色在左边框类上）
    expect(screen.getByRole('button', { name: '谢华 提名递交' }).className).toContain('border-l-[#7e887e]')
    expect(screen.getByRole('button', { name: '谢华 下签' }).className).toContain('border-l-[#357a52]')
    // 不画审理时长跨度
    expect(document.querySelector('progress')).toBeNull()
    expect(screen.queryByText(/\d+ 个月/)).toBeNull()
  })

  it('点彩条 → 同页详情 popover（客户+类型+案件号+去案件），「去案件」跳对应案件、不整页跳', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: '谢华 下签' }))
    expect(screen.getByText(/案件号 99710250/)).toBeInTheDocument()
    expect(navigateSpy).not.toHaveBeenCalled() // 点彩条本身不跳
    fireEvent.click(screen.getByRole('button', { name: '去案件 →' }))
    expect(navigateSpy).toHaveBeenCalledWith('/customers/P?case=ca1', expect.anything())
  })

  it('某天超 2 条 → 折叠「+N 个更多」→ 当天全部事件 popover，每条可去案件', () => {
    const tasks = [1, 2, 3, 4].map((i) => mkTask({ id: `t${i}`, content: `体检材料${i}`, due_date: '2026-06-16' }))
    renderPage({ history: [], tasks })
    const more = screen.getByRole('button', { name: '+2 个更多' })
    fireEvent.click(more)
    expect(screen.getByText(/共 4 件/)).toBeInTheDocument()
    const goBtns = screen.getAllByRole('button', { name: '去案件 →' })
    expect(goBtns).toHaveLength(4)
    fireEvent.click(goBtns[0])
    expect(navigateSpy).toHaveBeenCalledWith('/customers/P?case=ca1', expect.anything())
  })

  it('自定义提醒 = 紫条（#7c6fd6），详情 popover 列出内容', () => {
    renderPage({ history: [], reminders: [mkRem({ id: 'r1', content: '办 186 TRT', base_date: '2026-06-16' })] })
    const rem = screen.getByRole('button', { name: '谢华 提醒' })
    expect(rem.className).toContain('border-l-[#7c6fd6]')
    fireEvent.click(rem)
    expect(screen.getByText('办 186 TRT')).toBeInTheDocument()
  })

  it('无顶部「新建提醒」按钮；唯一入口=日期格「+」→ 同页浮窗、基准日预填该日，无路由变化', () => {
    renderPage()
    expect(screen.queryByRole('button', { name: /新建提醒/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: '新建提醒' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '给 2026-06-10 加提醒' }))
    expect(screen.getByRole('dialog', { name: '新建提醒' })).toBeInTheDocument()
    expect((screen.getByLabelText('基准日') as HTMLInputElement).value).toBe('2026-06-10')
    expect(navigateSpy).not.toHaveBeenCalled()
  })

  it('视图切换：周 → 只显本周(6/15–6/21)，本周外事件(6/3 递交)不在；日 → 只今天', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: '周' }))
    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getByText('21')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '谢华 下签' })).toBeInTheDocument() // 6/20 在本周
    expect(screen.queryByRole('button', { name: '谢华 提名递交' })).not.toBeInTheDocument() // 6/3 不在本周
    // 日视图：今天 6/16，默认事件均不在 6/16 → 无事件
    fireEvent.click(screen.getByRole('button', { name: '日' }))
    expect(screen.getByText('无事件')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '谢华 下签' })).not.toBeInTheDocument()
  })

  it('「今天」按钮：翻到下月后点它 → 回到本月并重新高亮今天', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: '下一页' })) // → 2026-07
    expect(screen.queryByRole('button', { name: '谢华 下签' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '今天' }))
    expect(screen.getByRole('button', { name: '谢华 下签' })).toBeInTheDocument()
    expect(screen.getByText('16').className).toContain('bg-emerald-600')
  })

  it('搜索：按事件类型过滤彩条', () => {
    renderPage()
    fireEvent.change(screen.getByLabelText('搜索事件'), { target: { value: '下签' } })
    expect(screen.getByRole('button', { name: '谢华 下签' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '谢华 提名递交' })).not.toBeInTheDocument()
  })
})
