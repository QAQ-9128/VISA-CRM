import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthContext } from '../../providers/auth-context'
import type { AuthContextValue } from '../../providers/auth-context'

// 只 mock 写入 api，验证 mutation 成功后失效了哪些 query key（同源链接证明）
vi.mock('../../api/payments', async (orig) => {
  const actual = await orig<typeof import('../../api/payments')>()
  return {
    ...actual,
    createInstallment: vi.fn().mockResolvedValue({ id: 'inst1' }),
    createPayment: vi.fn().mockResolvedValue({ id: 'pay1' }),
  }
})

import { useCreateInstallment, useCreatePayment } from './usePayments'

const authValue = { user: { id: 'u1' }, loading: false, session: null, profile: null, isAdmin: true, signIn: async () => {}, signOut: async () => {} } as unknown as AuthContextValue

function wrap(qc: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>
    </QueryClientProvider>
  )
}

beforeEach(() => vi.clearAllMocks())

describe('付款区 ↔ 财务页 同源链接（缓存失效覆盖两侧）', () => {
  it('创建分期 → 同时失效 payments.installments(plan) + finance.installments + dashboard.unpaidInstallments', async () => {
    const qc = new QueryClient()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useCreateInstallment('plan-1'), { wrapper: wrap(qc) })

    await result.current.mutateAsync({ payment_plan_id: 'plan-1', label: '首期', due_date: '2026-06-01', amount: 1000 })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(spy).toHaveBeenCalledWith({ queryKey: ['payments', 'installments', 'plan-1'] }) // 付款区分期视图
    expect(spy).toHaveBeenCalledWith({ queryKey: ['finance', 'installments'] }) // 财务页应收管理分期进度（关键链接修复）
    expect(spy).toHaveBeenCalledWith({ queryKey: ['dashboard', 'unpaidInstallments'] }) // 概览逾期分期
  })

  it('记一笔收款 → 同时失效 payments.byCase(case) + dashboard.payments（月度账目/应收同源刷新）', async () => {
    const qc = new QueryClient()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useCreatePayment('case-1'), { wrapper: wrap(qc) })

    await result.current.mutateAsync({ case_id: 'case-1', direction: 'from_client', amount: 500, method: 'transfer', paid_at: '2026-06-02' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(spy).toHaveBeenCalledWith({ queryKey: ['payments', 'byCase', 'case-1'] }) // 付款区
    expect(spy).toHaveBeenCalledWith({ queryKey: ['dashboard', 'payments'] }) // 财务页月度账目/应收（同一份 payments）
  })
})
