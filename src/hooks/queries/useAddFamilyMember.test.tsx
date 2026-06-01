import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAddFamilyMember } from './useCustomers'

// 只 mock api 的 addFamilyMember；其余导出保留（useCustomers.ts 模块加载时会引用到）
vi.mock('../../api/customers', async (orig) => {
  const actual = await orig<typeof import('../../api/customers')>()
  return { ...actual, addFamilyMember: vi.fn().mockResolvedValue({ id: 'm1', full_name: '小明' }) }
})

function wrapperWith(qc: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

beforeEach(() => vi.clearAllMocks())

describe('useAddFamilyMember', () => {
  it('成功后失效客户列表 + 家庭组(subApplicants) 的 query key', async () => {
    const qc = new QueryClient()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useAddFamilyMember('primary1'), { wrapper: wrapperWith(qc) })

    await result.current.mutateAsync({ full_name: '小明', gender: 'male', birth_date: null, relationship_to_primary: '子女' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(spy).toHaveBeenCalledWith({ queryKey: ['customers'] }) // 客户列表（前缀含家庭组）
    expect(spy).toHaveBeenCalledWith({ queryKey: ['customers', 'sub', 'primary1'] }) // 家庭组
  })
})
