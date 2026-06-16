import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthContext } from '../../providers/auth-context'
import type { AuthContextValue } from '../../providers/auth-context'
import type { Case, Customer } from '../../types/models'

vi.mock('../../api/reminders', async (orig) => {
  const actual = await orig<typeof import('../../api/reminders')>()
  return { ...actual, createReminder: vi.fn().mockResolvedValue({ id: 'NEW' }) }
})
import * as remApi from '../../api/reminders'
import { ReminderPanel } from './ReminderPanel'

const mkCust = (o: Partial<Customer>): Customer => ({
  id: 'P', full_name: '谢华', chinese_name: '谢华', english_name: null, birth_date: null, gender: null,
  passport_no: null, nationality: null, phone: null, email: null, wechat: null, address: null,
  sponsor_employer_id: null, sponsor_position: null, referrer_id: null, owner_referrer_id: null,
  primary_applicant_id: null, relationship_to_primary: null, client_source: null, is_starred: false,
  notes: null, assigned_to: null, created_by: null, is_archived: false, created_at: '', updated_at: '', ...o,
})
const mkCase = (o: Partial<Case>): Case => ({
  id: 'ca1', case_number: '99710250', customer_id: 'P', visa_subclass: '186', visa_stream: 'Temporary Residence Transition',
  case_category: null, case_details: null, destination_country: null, sponsor_position: null, sponsor_employer_id: null,
  immi_account_id: null, current_stage: 'visa_lodged', currency: 'AUD', sync_tracking: true,
  trt_reminder_enabled: false, trt_reminder_dismissed: false, cohab_reminder_enabled: false, cohab_reminder_last: null,
  parent_case_id: null, parent_sync_progress: false, assigned_to: null, created_by: null, is_archived: false,
  created_at: '', updated_at: '', ...o,
})

const cases = [mkCase({ id: 'ca1', customer_id: 'P', case_number: '99710250' }), mkCase({ id: 'ca2', customer_id: 'Q', case_number: '88800001', visa_subclass: '482' })]
const customerById = { P: mkCust({ id: 'P', chinese_name: '谢华' }), Q: mkCust({ id: 'Q', chinese_name: '王芳' }) }
const authValue = { user: { id: 'u1' }, loading: false, session: null, profile: null, isAdmin: true, signIn: async () => {}, signOut: async () => {} } as unknown as AuthContextValue

function renderPanel(baseDate = '2026-06-16') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={authValue}>
        <ReminderPanel cases={cases} customerById={customerById} baseDate={baseDate} onClose={() => {}} />
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

beforeEach(() => vi.clearAllMocks())

describe('ReminderPanel（新建提醒：必选已有案件 + 基准日 + 可拖动）', () => {
  it('未选案件 → 保存禁用；选了案件 + 写内容 → 可保存，createReminder 带 case_id + base_date（默认 offset 0）', async () => {
    renderPanel('2026-06-16')
    const saveBtn = screen.getByRole('button', { name: '保存提醒' })
    expect(saveBtn).toBeDisabled() // ① 没选案件不能存
    // 基准日预填 + 实时预览（offset 0 → 就在基准日当天）
    expect((screen.getByLabelText('基准日') as HTMLInputElement).value).toBe('2026-06-16')
    expect(screen.getByText(/将于/)).toHaveTextContent('将于 2026年6月16日(周二) 提醒 · 0 = 就在基准日当天')

    fireEvent.change(screen.getByLabelText('搜索案件'), { target: { value: '谢华' } })
    fireEvent.click(screen.getByRole('button', { name: /谢华 99710250/ }))
    expect(screen.getByText('更换')).toBeInTheDocument()

    expect(saveBtn).toBeDisabled() // 仍需内容
    fireEvent.change(screen.getByLabelText('内容'), { target: { value: '更新同居材料' } })
    expect(saveBtn).not.toBeDisabled()

    fireEvent.click(saveBtn)
    await waitFor(() =>
      expect(remApi.createReminder).toHaveBeenCalledWith(
        expect.objectContaining({ case_id: 'ca1', content: '更新同居材料', base_date: '2026-06-16', offset_value: 0, offset_unit: 'day', repeat_rule: 'never' }),
      ),
    )
  })

  it('实际提醒日预览随 基准日/数字/单位 实时更新（本地日期）', () => {
    renderPanel('2026-06-04')
    const preview = () => screen.getByText(/将于/).textContent
    // 默认 offset 0 → 就在基准日当天（2026-06-04 周四）
    expect(preview()).toContain('将于 2026年6月4日(周四) 提醒')
    expect(preview()).toContain('就在基准日当天')
    // 改数字=2、单位=年 → 2028-06-04（周日）
    fireEvent.change(screen.getByLabelText('偏移数字'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('偏移单位'), { target: { value: 'year' } })
    expect(preview()).toContain('将于 2028年6月4日(周日) 提醒')
    expect(preview()).not.toContain('就在基准日当天')
    // 改基准日 → 预览跟随（2026-01-31 + 2 月 → 月末夹取 2026-03-31）
    fireEvent.change(screen.getByLabelText('基准日'), { target: { value: '2026-01-31' } })
    fireEvent.change(screen.getByLabelText('偏移单位'), { target: { value: 'month' } })
    expect(preview()).toContain('将于 2026年3月31日')
  })

  it('案件搜索按客户名 / 案件号命中', () => {
    renderPanel()
    fireEvent.change(screen.getByLabelText('搜索案件'), { target: { value: '88800001' } })
    expect(screen.getByRole('button', { name: /王芳 88800001/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /谢华/ })).not.toBeInTheDocument()
  })

  it('标题栏作为拖动把手：pointerdown + move → 浮窗位置更新', () => {
    renderPanel()
    const dialog = screen.getByRole('dialog', { name: '新建提醒' })
    const startLeft = dialog.style.left // 初始居中（jsdom innerWidth 1024 → 212px）
    const handle = screen.getByText('新建提醒').closest('div') as HTMLElement
    fireEvent.pointerDown(handle, { clientX: 300, clientY: 100 })
    fireEvent.pointerMove(window, { clientX: 360, clientY: 150 })
    expect(dialog.style.left).not.toBe(startLeft)
    expect(dialog.style.left).toBe('272px') // 212 + 60
    expect(dialog.style.top).toBe('122px') // 72 + 50
    fireEvent.pointerUp(window)
  })
})
