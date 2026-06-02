import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

// 用受控数据替换 useFinance（初始渲染不触发任何网络查询）
const { state } = vi.hoisted(() => ({ state: { data: null as unknown } }))
vi.mock('../../hooks/queries/useFinance', () => ({ useFinance: () => state.data }))

import { FinancePage } from './FinancePage'

const receipt = (o: Record<string, unknown>) => ({
  paymentId: 'p', amount: 0, method: 'transfer', customerName: '客户', customerId: 'cu', payerId: 'cu',
  fromClientCustomerId: null, visaSubclass: '482', caseNumber: '00000000', paidAt: '2026-06-01',
  note: null, feeCategory: '律师费', caseId: 'c1', invoicePath: null, invoiceName: null, ...o,
})
const payout = (o: Record<string, unknown>) => ({
  paymentId: 'x', direction: 'to_company', amount: 0, method: 'transfer', customerName: '张三',
  referrerName: null, paidAt: '2026-06-03', note: null, caseId: 'c1', ...o,
})

function setData(over: Record<string, unknown> = {}) {
  state.data = {
    isPending: false, isError: false,
    receivables: [], recentCaseIds: [],
    receipts: {
      total: 8000,
      items: [
        receipt({ paymentId: 'p1', amount: 3000, customerName: '邓韬', caseNumber: '12345678' }),
        receipt({ paymentId: 'p2', amount: 5000, customerName: '孙佳琪', method: 'cash', caseNumber: '70193357', caseId: 'c2' }),
      ],
    },
    payouts: { items: [payout({ paymentId: 'x1', amount: 5000 })], toCompanyTotal: 5000, toReferrerTotal: 0 },
    caseOptions: [], referrerById: {}, instByPlan: new Map(), caseNumberByCaseId: {},
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

describe('FinancePage · 月度账目', () => {
  it('三卡数值：本月总收入 / 总支出 / 净额', () => {
    renderPage()
    expect(screen.getAllByText('AUD 8,000.00').length).toBeGreaterThan(0) // 总收入
    expect(screen.getAllByText('AUD 5,000.00').length).toBeGreaterThan(0) // 总支出
    expect(screen.getByText('AUD 3,000.00')).toBeInTheDocument() // 净额 = 8000 - 5000
  })

  it('合并表「本月交易」：收/支同表，含付款方/对象姓名', () => {
    renderPage()
    expect(screen.getByText('本月交易')).toBeInTheDocument()
    expect(screen.getByText('邓韬')).toBeInTheDocument() // 收款行
    expect(screen.getByText('张三')).toBeInTheDocument() // 支出行
  })

  it('共 N 笔（收入 X · 支出 Y）', () => {
    renderPage()
    // 2 收款 + 1 支出 = 3 笔（收入 2 · 支出 1）
    const p = screen.getByText(/笔（收入/)
    expect(p.textContent?.replace(/\s/g, '')).toBe('共3笔（收入2·支出1）')
  })

  it('收入行不含案件编号 #XXXXXXXX', () => {
    renderPage()
    expect(screen.queryByText('#12345678')).toBeNull()
    expect(screen.queryByText('#70193357')).toBeNull()
  })

  it('收入 +绿 / 支出 −红 金额', () => {
    renderPage()
    expect(screen.getByText('+AUD 3,000.00')).toBeInTheDocument()
    expect(screen.getByText(/^[−-]AUD 5,000\.00$/)).toBeInTheDocument()
  })

  it('全部 / 收入 / 支出 切换作用于合并表（过滤行）', () => {
    renderPage()
    // 全部：收款行(邓韬) + 支出行(张三) 都在
    expect(screen.getByText('邓韬')).toBeInTheDocument()
    expect(screen.getByText('张三')).toBeInTheDocument()
    // 只看收入：支出行消失
    fireEvent.click(screen.getByRole('button', { name: '收入' }))
    expect(screen.getByText('邓韬')).toBeInTheDocument()
    expect(screen.queryByText('张三')).toBeNull()
    // 只看支出：收款行消失
    fireEvent.click(screen.getByRole('button', { name: '支出' }))
    expect(screen.queryByText('邓韬')).toBeNull()
    expect(screen.getByText('张三')).toBeInTheDocument()
  })

  it('「+ 记收款」/「+ 加支出」按钮都在（空状态也显示）', () => {
    setData({ receipts: { total: 0, items: [] }, payouts: { items: [], toCompanyTotal: 0, toReferrerTotal: 0 } })
    renderPage()
    expect(screen.getByRole('button', { name: '+ 记收款' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ 加支出' })).toBeInTheDocument()
    expect(screen.getByText('本月暂无账目')).toBeInTheDocument()
  })

  it('空数据不崩', () => {
    setData({ receipts: { total: 0, items: [] }, payouts: { items: [], toCompanyTotal: 0, toReferrerTotal: 0 } })
    expect(() => renderPage()).not.toThrow()
  })
})
