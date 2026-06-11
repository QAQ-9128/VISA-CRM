import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

// 用受控数据替换 useFinance（初始渲染不触发任何网络查询）；记录传入的周期（月度/财年）
const { state } = vi.hoisted(() => ({
  state: { data: null as unknown, lastPeriod: null as unknown },
}))
vi.mock('../../hooks/queries/useFinance', () => ({
  useFinance: (period: unknown) => {
    state.lastPeriod = period
    return state.data
  },
}))
// 固定「今天」= 2026-06-05（默认月 2026-06，当前财年 2025–26）
vi.mock('../../lib/month', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../lib/month')>()
  return { ...mod, currentMonth: () => '2026-06' }
})
vi.mock('../../lib/dateRules', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../lib/dateRules')>()
  return { ...mod, auFinancialYear: () => mod.fyOfEndYear(2026) }
})

import { FinancePage } from './FinancePage'

const receipt = (o: Record<string, unknown>) => ({
  paymentId: 'p', amount: 0, method: 'transfer', customerName: '客户', customerId: 'cu', payerId: 'cu',
  fromClientCustomerId: null, visaSubclass: '482', caseNumber: '00000000', paidAt: '2026-06-01',
  note: null, feeCategory: '律师费', caseId: 'c1', invoicePath: null, invoiceName: null, ...o,
})
const payout = (o: Record<string, unknown>) => ({
  paymentId: 'x', direction: 'to_company', amount: 0, method: 'transfer', customerName: '张三',
  customerId: 'cu', referrerName: null, paidAt: '2026-06-03', note: null, caseId: 'c1', ...o,
})
const empty = { items: [], total: 0 }
const emptyPayouts = { items: [], toCompanyTotal: 0, toReferrerTotal: 0, miscTotal: 0 }

function setData(over: Record<string, unknown> = {}) {
  state.data = {
    isPending: false, isError: false,
    receipts: {
      total: 22200,
      items: [
        receipt({ paymentId: 'p1', amount: 6500, customerName: '贾乃亮', payerId: 'cu1', feeCategory: '律师费', note: '首期', visaSubclass: '482', paidAt: '2026-06-03' }),
        receipt({ paymentId: 'p2', amount: 2200, customerName: '李小璐', payerId: 'cu2', feeCategory: '申请服务费', note: null, visaSubclass: '600', paidAt: '2026-06-08', caseId: 'c2' }),
      ],
    },
    payouts: {
      toCompanyTotal: 4200,
      toReferrerTotal: 2300,
      miscTotal: 350,
      items: [
        payout({ paymentId: 'x1', amount: 3000, customerName: '张三', note: '提名代理费', paidAt: '2026-06-05' }),
        payout({ paymentId: 'x2', amount: 1200, customerName: '李四', note: null, paidAt: '2026-06-10', caseId: 'c2' }),
        payout({ paymentId: 'x3', direction: 'to_referrer', amount: 800, customerName: '张三', referrerName: '王某', note: '介绍佣金', paidAt: '2026-06-15' }),
        payout({ paymentId: 'x4', direction: 'to_referrer', amount: 1500, customerName: '李四', referrerName: 'RV Design', note: null, paidAt: '2026-06-22', caseId: 'c2' }),
        payout({ paymentId: 'x5', direction: 'misc_expense', amount: 350, customerName: '张三', note: '体检费垫付', paidAt: '2026-06-18' }),
      ],
    },
    // 上月：净额 14000 → 本月 15350，较上月 +1350 (+10%)
    prevReceipts: { total: 17000, items: [receipt({ paymentId: 'pp', amount: 17000, paidAt: '2026-05-02' })] },
    prevPayouts: { toCompanyTotal: 2000, toReferrerTotal: 1000, miscTotal: 0, items: [payout({ paymentId: 'xp', amount: 2000, paidAt: '2026-05-03' })] },
    visaByCaseId: { c1: '482', c2: '600' },
    ...over,
  }
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <FinancePage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => setData())

describe('FinancePage · 月度账目（mockup 重做）', () => {
  it('衬线大标题「月度账目」+ 副标双流对照', () => {
    renderPage()
    const h = screen.getByRole('heading', { name: '月度账目' })
    expect(h.className).toContain('font-serif')
    expect(screen.getByText('收入 / 支出 双流对照')).toBeInTheDocument()
  })

  it('三 KPI：本月收入 / 本月支出 / 本月净额，数值来自现有聚合（支出含垫付杂项三流）', () => {
    renderPage()
    expect(screen.getByText('本月收入 · 客户已收')).toBeInTheDocument()
    expect(screen.getByText('本月支出 · 付主代理 + 介绍人 + 垫付')).toBeInTheDocument()
    expect(screen.getByText('本月净额')).toBeInTheDocument()
    // 收入 22,200（KPI + 收入栏小计 + 小计条 + 净额条公式，多处出现）
    expect(screen.getAllByText('22,200.00').length).toBeGreaterThan(1)
    expect(screen.getAllByText('6,850.00').length).toBeGreaterThan(0) // 支出 = 4200 + 2300 + 350
    expect(screen.getAllByText('15,350.00').length).toBeGreaterThan(1) // 净额（KPI + 净额条）
  })

  it('净额 == 收入 − 付主代理 − 付介绍人 − 垫付杂项（三流恒等，22200−4200−2300−350=15350）', () => {
    renderPage()
    expect(screen.getAllByText('15,350.00').length).toBeGreaterThan(0)
  })

  it('支出 KPI 小字 = 真实分组和「付主代理 4,200.00 · 付介绍人 2,300.00 · 垫付杂项 350.00」', () => {
    renderPage()
    expect(screen.getByText(/付主代理 4,200\.00 · 付介绍人 2,300\.00 · 垫付杂项 350\.00/)).toBeInTheDocument()
  })

  it('收入 KPI 不显示「开票应收 / 已收率」（无真实来源 → 整行省略）', () => {
    renderPage()
    expect(screen.queryByText(/开票应收/)).toBeNull()
    expect(screen.queryByText(/已收率/)).toBeNull()
  })

  it('净额 KPI / 净额条：较上月 +AUD 1,350.00（+10%）', () => {
    renderPage()
    const deltas = screen.getAllByText(/较上月/)
    expect(deltas.length).toBeGreaterThan(0)
    expect(screen.getAllByText(/1,350\.00/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/\+10%/).length).toBeGreaterThan(0)
  })

  it('收入栏：客户名 + 签证 tag + 款项 + 金额 + 日期；小计条（2 笔）', () => {
    renderPage()
    expect(screen.getByText('贾乃亮')).toBeInTheDocument()
    expect(screen.getByText('律师费 · 首期')).toBeInTheDocument()
    expect(screen.getByText('6月3日')).toBeInTheDocument()
    expect(screen.getByText(/收入小计（2 笔）/)).toBeInTheDocument()
    expect(screen.getByText('客户已收（from_client）')).toBeInTheDocument()
  })

  it('支出栏：分「付主代理 / 付介绍人 / 垫付杂项」三组；介绍人行显示介绍人名；小计条（5 笔）', () => {
    renderPage()
    expect(screen.getByText('付主代理（to_company）')).toBeInTheDocument()
    expect(screen.getByText('付介绍人（to_referrer）')).toBeInTheDocument()
    expect(screen.getByText('垫付杂项（misc_expense）')).toBeInTheDocument()
    expect(screen.getByText('王某')).toBeInTheDocument()
    expect(screen.getByText('RV Design')).toBeInTheDocument()
    expect(screen.getByText('提名代理费')).toBeInTheDocument()
    expect(screen.getByText('体检费垫付')).toBeInTheDocument()
    expect(screen.getByText(/支出小计（5 笔）/)).toBeInTheDocument()
  })

  it('净额结算条：本月净额（双流恒等）+ 公式 收入 − 支出（含垫付杂项）', () => {
    renderPage()
    expect(screen.getByText('本月净额（双流恒等）')).toBeInTheDocument()
    expect(screen.getByText(/收入 22,200\.00/)).toBeInTheDocument()
    expect(screen.getByText(/支出 6,850\.00/)).toBeInTheDocument()
  })

  it('月份切换：默认当前月（2026年6月 + 本月 chip），‹ 切到 2026年5月并重新取数', () => {
    renderPage()
    expect(screen.getByText('2026年6月')).toBeInTheDocument()
    expect(screen.getByText('本月')).toBeInTheDocument() // pill 内 chip（精确匹配）
    expect(state.lastPeriod).toEqual({ kind: 'month', month: '2026-06' })
    fireEvent.click(screen.getByRole('button', { name: '上个月' }))
    expect(screen.getByText('2026年5月')).toBeInTheDocument()
    expect(screen.queryByText('本月')).toBeNull() // 非当前月不显示 chip
    expect(state.lastPeriod).toEqual({ kind: 'month', month: '2026-05' })
    // 非当前月文案退「当月」
    expect(screen.getByText('当月收入 · 客户已收')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '下个月' }))
    expect(screen.getByText('2026年6月')).toBeInTheDocument()
  })

  it('空月：优雅空态 + 全 0，不报错、不出假数字、不显示较上月', () => {
    setData({
      receipts: empty,
      payouts: emptyPayouts,
      prevReceipts: empty,
      prevPayouts: emptyPayouts,
    })
    expect(() => renderPage()).not.toThrow()
    expect(screen.getByText('本月暂无收入')).toBeInTheDocument()
    expect(screen.getByText('本月暂无支出')).toBeInTheDocument()
    expect(screen.getAllByText('0.00').length).toBeGreaterThan(0)
    expect(screen.queryByText(/较上月/)).toBeNull() // 上月无流水 → 无对比基准 → 省略
    expect(screen.getByText(/收入小计（0 笔）/)).toBeInTheDocument()
  })

  it('无残留旧应收管理元素', () => {
    renderPage()
    expect(screen.queryByText('近期案件应收')).toBeNull()
    expect(screen.queryByText('总应收')).toBeNull()
    expect(screen.queryByText('待收款')).toBeNull()
    expect(screen.queryByText('本月交易')).toBeNull()
    expect(screen.queryByText('+ 记收款')).toBeNull()
    expect(screen.queryByText('+ 加支出')).toBeNull()
    expect(screen.queryByText('全部状态')).toBeNull()
  })
})

describe('FinancePage · 财年模式（月度 / 财年 段控）', () => {
  const toFy = () => fireEvent.click(screen.getByRole('button', { name: '财年' }))

  it('段控默认月度：月度态与改前完全一致，财年按钮存在且选中态可感知（aria-pressed）', () => {
    renderPage()
    expect(screen.getByRole('button', { name: '月度' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '财年' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('heading', { name: '月度账目' })).toBeInTheDocument()
    expect(state.lastPeriod).toEqual({ kind: 'month', month: '2026-06' })
    toFy()
    expect(screen.getByRole('button', { name: '财年' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('切到财年：财年选择器「2025–26 财年」+ 本财年 chip + 起止日期，取数窗口换成 FY', () => {
    renderPage()
    toFy()
    expect(state.lastPeriod).toEqual({ kind: 'fy', endYear: 2026 })
    expect(screen.getByText('2025–26 财年')).toBeInTheDocument()
    expect(screen.getByText('本财年')).toBeInTheDocument()
    expect(screen.getByText('2025-07-01 ~ 2026-06-30')).toBeInTheDocument()
  })

  it('财年 KPI 三卡：本财年收入 / 本财年支出 / 本财年净额；小计与底部条同改口径', () => {
    renderPage()
    toFy()
    expect(screen.getByText('本财年收入 · 客户已收')).toBeInTheDocument()
    expect(screen.getByText('本财年支出 · 付主代理 + 介绍人 + 垫付')).toBeInTheDocument()
    expect(screen.getByText('本财年净额')).toBeInTheDocument()
    expect(screen.getAllByText('本财年小计').length).toBe(2)
    expect(screen.getByText('本财年净额（双流恒等）')).toBeInTheDocument()
  })

  it('财年汇总三流恒等：净额 = 收入 − 付主代理 − 付介绍人 − 垫付杂项（同一套聚合，只换窗口）', () => {
    renderPage()
    toFy()
    // 22200 − (4200 + 2300 + 350) = 15350，KPI + 净额条都出现
    expect(screen.getAllByText('15,350.00').length).toBeGreaterThan(1)
    expect(screen.getByText(/收入 22,200\.00/)).toBeInTheDocument()
    expect(screen.getByText(/支出 6,850\.00/)).toBeInTheDocument()
    // 较上财年（上一财年有流水 → 真实对比）
    expect(screen.getAllByText(/较上财年/).length).toBeGreaterThan(0)
  })

  it('‹ 切上一财年：2024–25 财年、无本财年 chip、取数 endYear=2025；› 切回', () => {
    renderPage()
    toFy()
    fireEvent.click(screen.getByRole('button', { name: '上一财年' }))
    expect(screen.getByText('2024–25 财年')).toBeInTheDocument()
    expect(screen.getByText('2024-07-01 ~ 2025-06-30')).toBeInTheDocument()
    expect(screen.queryByText('本财年')).toBeNull()
    expect(state.lastPeriod).toEqual({ kind: 'fy', endYear: 2025 })
    // 非当前财年文案退「该财年」
    expect(screen.getByText('该财年收入 · 客户已收')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '下一财年' }))
    expect(screen.getByText('2025–26 财年')).toBeInTheDocument()
    expect(state.lastPeriod).toEqual({ kind: 'fy', endYear: 2026 })
  })

  it('空财年：空态 + 全 0，不报错、不显示较上财年', () => {
    setData({
      receipts: empty,
      payouts: emptyPayouts,
      prevReceipts: empty,
      prevPayouts: emptyPayouts,
    })
    expect(() => {
      renderPage()
      toFy()
    }).not.toThrow()
    expect(screen.getByText('本财年暂无收入')).toBeInTheDocument()
    expect(screen.getByText('本财年暂无支出')).toBeInTheDocument()
    expect(screen.getAllByText('0.00').length).toBeGreaterThan(0)
    expect(screen.queryByText(/较上财年/)).toBeNull()
  })

  it('切回月度：恢复月份选择器与月度取数（月度回归）', () => {
    renderPage()
    toFy()
    fireEvent.click(screen.getByRole('button', { name: '月度' }))
    expect(screen.getByText('2026年6月')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '月度账目' })).toBeInTheDocument()
    expect(state.lastPeriod).toEqual({ kind: 'month', month: '2026-06' })
    expect(screen.getByText('本月收入 · 客户已收')).toBeInTheDocument()
  })
})

describe('FinancePage · 月度 ↔ 财年 跟随联动', () => {
  const toFy = () => fireEvent.click(screen.getByRole('button', { name: '财年' }))
  const toMonth = () => fireEvent.click(screen.getByRole('button', { name: '月度' }))

  it('月→财：财年自动跳到包含所选月份的财年（2026年7月 → 2026–27 财年）', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: '下个月' })) // 2026-07，已属下一财年
    toFy()
    expect(screen.getByText('2026–27 财年')).toBeInTheDocument()
    expect(state.lastPeriod).toEqual({ kind: 'fy', endYear: 2027 })
  })

  it('财→月：原月份不在所选财年内 → 过去财年跳到该财年末月 6 月', () => {
    renderPage() // month=2026-06
    toFy() // 跟随 → 2025–26
    fireEvent.click(screen.getByRole('button', { name: '上一财年' })) // 2024–25
    toMonth()
    expect(screen.getByText('2025年6月')).toBeInTheDocument()
    expect(state.lastPeriod).toEqual({ kind: 'month', month: '2025-06' })
  })

  it('财→月：原月份在所选财年内 → 保留原月份（来回切不丢位置）', () => {
    renderPage() // month=2026-06 ∈ 2025–26 财年
    toFy()
    expect(screen.getByText('2025–26 财年')).toBeInTheDocument() // 跟随当前月所属财年
    toMonth()
    expect(screen.getByText('2026年6月')).toBeInTheDocument()
    expect(screen.getByText('本月')).toBeInTheDocument()
    expect(state.lastPeriod).toEqual({ kind: 'month', month: '2026-06' })
  })

  it('财→月：未来财年 → 跳到该财年首月 7 月', () => {
    renderPage()
    toFy()
    fireEvent.click(screen.getByRole('button', { name: '下一财年' })) // 2026–27（未来）
    toMonth()
    expect(screen.getByText('2026年7月')).toBeInTheDocument()
    expect(state.lastPeriod).toEqual({ kind: 'month', month: '2026-07' })
  })
})
