import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { todayYmd } from '../../lib/dateRules'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthContext } from '../../providers/auth-context'
import type { AuthContextValue } from '../../providers/auth-context'
import { PayablePanel } from './PayablePanel'
import type { Accounting } from '../../lib/accounting'
import type { PaymentPlan } from '../../types/models'

const authValue = {
  user: { id: 'u1' },
  loading: false,
  session: null,
  profile: null,
  isAdmin: true,
  signIn: async () => {},
  signOut: async () => {},
} as unknown as AuthContextValue

const acct = (over: Partial<Accounting> = {}): Accounting => ({
  clientPaid: 0,
  clientOwes: 0,
  companyPaid: 0,
  companyOwes: 0,
  referrerPaid: 0,
  referrerOwes: 0,
  ...over,
})
const plan = (over: Partial<PaymentPlan> = {}): PaymentPlan =>
  ({
    id: 'p1',
    case_id: 'c1',
    applicant_id: null,
    billed_to_customer_id: null,
    client_total: null,
    company_total: null,
    referrer_total: null,
    staged_billing: false,
    currency: 'AUD',
    note: null,
    created_at: '',
    updated_at: '',
    ...over,
  }) as PaymentPlan

function renderPanel(p: PaymentPlan | undefined, a: Accounting) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={authValue}>
        <PayablePanel caseId="c1" plan={p} currency="AUD" acct={a} />
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

describe('PayablePanel 每行操作 + 状态派生', () => {
  it('已设应付 + 已结清 → 该行显示 编辑 + 记付款、pill「已结清」，不显示「设置应付」', () => {
    renderPanel(
      plan({ company_total: 1650 }),
      acct({ companyPaid: 1650, companyOwes: 0 }),
    )
    const row = within(screen.getByTestId('payable-to_company'))
    expect(row.getByText('已结清')).toBeInTheDocument()
    expect(row.getByText('编辑')).toBeInTheDocument()
    expect(row.getByText('记付款')).toBeInTheDocument()
    expect(row.queryByText('设置应付')).not.toBeInTheDocument()
    expect(row.getByText(/应付.*已付/)).toBeInTheDocument()
  })

  it('欠款行 → pill「欠 AUD …」+ 编辑/记付款', () => {
    renderPanel(plan({ referrer_total: 800 }), acct({ referrerPaid: 300, referrerOwes: 500 }))
    const row = within(screen.getByTestId('payable-to_referrer'))
    expect(row.getByText(/欠 .*500/)).toBeInTheDocument()
    expect(row.getByText('记付款')).toBeInTheDocument()
  })

  it('未设应付 → pill「未设应付」，但仍恒显「编辑 + 记付款」，不显示金额行', () => {
    renderPanel(plan(), acct())
    const row = within(screen.getByTestId('payable-to_referrer'))
    expect(row.getByText('未设应付')).toBeInTheDocument()
    expect(row.getByText('编辑')).toBeInTheDocument()
    expect(row.getByText('记付款')).toBeInTheDocument()
    expect(row.queryByText('设置应付')).not.toBeInTheDocument()
    expect(row.queryByText(/应付.*已付/)).not.toBeInTheDocument()
  })

  it('两行（主代理 + 介绍人）都恒有「编辑 + 记付款」', () => {
    renderPanel(plan({ company_total: 1650 }), acct({ companyPaid: 1650 }))
    for (const dir of ['payable-to_company', 'payable-to_referrer']) {
      const row = within(screen.getByTestId(dir))
      expect(row.getByText('编辑')).toBeInTheDocument()
      expect(row.getByText('记付款')).toBeInTheDocument()
    }
  })

  it('空数据（无 plan、全 0）→ 两行都「未设应付」+ 编辑/记付款，不崩；无「设置应付」', () => {
    renderPanel(undefined, acct())
    expect(screen.getAllByText('未设应付')).toHaveLength(2)
    expect(screen.getAllByText('编辑')).toHaveLength(2)
    expect(screen.getAllByText('记付款')).toHaveLength(2)
    expect(screen.queryByText('设置应付')).not.toBeInTheDocument()
  })

  it('点「记付款」→ 展开记一笔付款表单（确认付款），接付款 flow', () => {
    renderPanel(plan({ company_total: 800 }), acct({ companyPaid: 0, companyOwes: 800 }))
    const row = within(screen.getByTestId('payable-to_company'))
    fireEvent.click(row.getByText('记付款'))
    expect(row.getByText('确认付款')).toBeInTheDocument()
    expect(row.getByLabelText(/金额/)).toBeInTheDocument()
  })

  it('金额必须 > 0：空/0/负数时「确认付款」禁用，正数才启用', () => {
    renderPanel(plan({ company_total: 800 }), acct({ companyOwes: 800 }))
    const row = within(screen.getByTestId('payable-to_company'))
    fireEvent.click(row.getByText('记付款'))
    const submit = row.getByText('确认付款')
    const amount = row.getByLabelText(/金额/)
    expect(submit).toBeDisabled() // 空
    fireEvent.change(amount, { target: { value: '0' } })
    expect(submit).toBeDisabled() // 零
    fireEvent.change(amount, { target: { value: '-5' } })
    expect(submit).toBeDisabled() // 负数
    fireEvent.change(amount, { target: { value: '100' } })
    expect(submit).not.toBeDisabled() // 正数
  })

  it('点介绍人「编辑」(未设亦可)→ 只显介绍人总额，不显主代理（互不混）', () => {
    renderPanel(undefined, acct())
    fireEvent.click(within(screen.getByTestId('payable-to_referrer')).getByText('编辑'))
    expect(screen.getByText('编辑介绍人应付')).toBeInTheDocument()
    expect(screen.getByText('应付介绍人总额')).toBeInTheDocument()
    expect(screen.queryByText('应付主代理总额')).not.toBeInTheDocument()
  })

  it('点主代理「编辑」→ 只显主代理总额，不显介绍人（互不混）', () => {
    renderPanel(plan({ company_total: 800 }), acct({ companyOwes: 800 }))
    fireEvent.click(within(screen.getByTestId('payable-to_company')).getByText('编辑'))
    expect(screen.getByText('编辑主代理应付')).toBeInTheDocument()
    expect(screen.getByText('应付主代理总额')).toBeInTheDocument()
    expect(screen.queryByText('应付介绍人总额')).not.toBeInTheDocument()
  })

  // 机器在 UTC+ 时区：本地清晨时 toISOString() 的 UTC 日期还是「昨天」甚至上个月。
  // 录款默认日期必须取本地日（todayYmd），否则早晨录款默认落错日/跨错月，污染月度账目。
  it('记付款的默认日期 = 本地日历日（UTC 日期与本地不同的清晨时刻不取 UTC）', () => {
    vi.useFakeTimers()
    try {
      // 该时刻 UTC=2026-06-04 22:00，东八区/澳东本地已是 2026-06-05 清晨
      vi.setSystemTime(new Date('2026-06-04T22:00:00Z'))
      renderPanel(plan({ company_total: 800 }), acct({ companyOwes: 800 }))
      const row = within(screen.getByTestId('payable-to_company'))
      fireEvent.click(row.getByText('记付款'))
      const input = row.getByLabelText('日期') as HTMLInputElement
      expect(input.value).toBe(todayYmd()) // 本地日，而非 toISOString 的 UTC 日
    } finally {
      vi.useRealTimers()
    }
  })

  it('顶部不再有单独的「编辑应付」入口（操作下放到每行）', () => {
    renderPanel(plan({ company_total: 800 }), acct({ companyOwes: 800 }))
    expect(screen.queryByText('编辑应付')).not.toBeInTheDocument()
  })
})
