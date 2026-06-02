import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReceivableRow, ReceivableTotals, FinanceReceipts, FinancePayouts } from '../../lib/finance'
import type { InstallmentSummary } from '../../lib/financeRows'

// 客户付款区只验证「按确认稿组合」：双流摘要（含跨案件已付出）+ 财务页同款分期进度富表 + 合并流水。
// 数据 hook 整体 mock（其同源/失效已由 usePayments.link.test 与 lib 选择器测试覆盖）。
const row: ReceivableRow = {
  caseId: 'c1', applicantId: null, role: 'primary', coApplicantNames: [], planId: 'p1',
  customerId: 'cu1', customerName: '张三', visaSubclass: '482',
  receivable: 12000, paid: 6000, unpaid: 6000, staged: false, stages: [],
}
const inst: InstallmentSummary = { total: 3, paid: 2, next: { label: '二期', dueDate: '2026-07-01', overdueDays: 0 }, hasOverdue: false }
const mockData = {
  isPending: false,
  isError: false,
  receivables: [row],
  receivableTotals: { receivable: 12000, paid: 6000, unpaid: 6000 } satisfies ReceivableTotals,
  receipts: { items: [], total: 6000 } satisfies FinanceReceipts,
  payouts: { items: [], toCompanyTotal: 0, toReferrerTotal: 500 } satisfies FinancePayouts,
  caseOptions: [],
  referrerById: {},
  instByPlan: new Map<string, InstallmentSummary>([['p1', inst]]),
  caseNumberByCaseId: { c1: 'CASE-001' },
}

vi.mock('../../hooks/queries/useCustomerFinance', () => ({
  useCustomerFinance: () => mockData,
}))

import { CustomerPaymentsSection } from './CustomerPaymentsSection'

function wrap(ui: ReactNode) {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CustomerPaymentsSection（客户付款区，复用财务页同款数据/组件）', () => {
  it('双流摘要含「已付出」卡 + 应收富表显示「分期进度」与 2/3 期 + 合并流水「收付款明细」', () => {
    wrap(<CustomerPaymentsSection customerId="cu1" />)
    // ① 双流摘要四卡（含跨案件已付出，区别于旧版只有总应收/已收/未收三卡）
    expect(screen.getByText('总应收')).toBeTruthy()
    expect(screen.getByText('已付出')).toBeTruthy()
    // ② 应收富表（财务页同款）：分期进度列 + 2/3 期圆点摘要
    expect(screen.getByText('分期进度')).toBeTruthy()
    expect(screen.getByText(/2\/3 期/)).toBeTruthy()
    // ③ 收付款明细（合并流水表）
    expect(screen.getByText('收付款明细')).toBeTruthy()
  })
})
