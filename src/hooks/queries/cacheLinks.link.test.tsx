import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthContext } from '../../providers/auth-context'
import type { AuthContextValue } from '../../providers/auth-context'
import type { ArchiveFile } from '../../lib/archive'

// 只 mock 写入 api，验证 mutation 成功后失效了哪些 query key（客户页 ↔ 案件页 ↔ 概览/财务 同源链接证明）。
// 注：同命名空间（如 records.byCase / records.byCustomer）靠 ['records'] 前缀失效天然联动；
// 这里补的是**跨命名空间**断链：documents → dashboard.expiringDocs、referrers → finance.referrers。
vi.mock('../../api/documents', async (orig) => {
  const actual = await orig<typeof import('../../api/documents')>()
  return {
    ...actual,
    createDocument: vi.fn().mockResolvedValue({ id: 'd1' }),
    updateDocument: vi.fn().mockResolvedValue({ id: 'd1' }),
    archiveDocument: vi.fn().mockResolvedValue(undefined),
  }
})
vi.mock('../../api/referrers', async (orig) => {
  const actual = await orig<typeof import('../../api/referrers')>()
  return { ...actual, updateReferrer: vi.fn().mockResolvedValue({ id: 'r1' }) }
})

import { useAddDocument, useArchiveDocument, useUpdateDocument } from './useDocuments'
import { useDeleteArchiveFile } from './useArchive'
import { useUpdateReferrer } from './useReferrers'

const authValue = { user: { id: 'u1' }, loading: false, session: null, profile: null, isAdmin: true, signIn: async () => {}, signOut: async () => {} } as unknown as AuthContextValue

function wrap(qc: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>
    </QueryClientProvider>
  )
}

beforeEach(() => vi.clearAllMocks())

describe('文件 ↔ 概览「即将到期」同源链接（跨命名空间，前缀盖不到）', () => {
  it('登记文件（带到期日）→ 失效 documents 前缀（客户/案件文件区）+ dashboard.expiringDocs', async () => {
    const qc = new QueryClient()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useAddDocument(), { wrapper: wrap(qc) })

    await result.current.mutateAsync({ customer_id: 'cu1', case_id: 'ca1', doc_type: 'passport', expiry_date: '2026-12-01' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(spy).toHaveBeenCalledWith({ queryKey: ['documents'] }) // 前缀盖 byCustomer/byCase/allList → 客户页与案件页同步
    expect(spy).toHaveBeenCalledWith({ queryKey: ['dashboard', 'expiringDocs'] }) // 概览到期提醒（关键链接修复）
  })

  it('改文件（如到期日）→ 同样两边失效', async () => {
    const qc = new QueryClient()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useUpdateDocument(), { wrapper: wrap(qc) })

    await result.current.mutateAsync({ id: 'd1', patch: { expiry_date: '2027-01-01' } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(spy).toHaveBeenCalledWith({ queryKey: ['documents'] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['dashboard', 'expiringDocs'] })
  })

  it('归档文件 → 同样两边失效', async () => {
    const qc = new QueryClient()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useArchiveDocument(), { wrapper: wrap(qc) })

    await result.current.mutateAsync('d1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(spy).toHaveBeenCalledWith({ queryKey: ['documents'] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['dashboard', 'expiringDocs'] })
  })

  it('档案库删除文件 → documents + dashboard.payments + dashboard.expiringDocs 全失效', async () => {
    const qc = new QueryClient()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useDeleteArchiveFile(), { wrapper: wrap(qc) })

    await result.current.mutateAsync({ source: 'document', sourceId: 'd1' } as unknown as ArchiveFile)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(spy).toHaveBeenCalledWith({ queryKey: ['documents'] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['dashboard', 'payments'] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['dashboard', 'expiringDocs'] })
  })
})

describe('介绍人 ↔ 财务/客户财务 同源链接（finance.referrers 是独立命名空间）', () => {
  it('改介绍人（如改名）→ 失效 referrers 前缀 + finance.referrers（财务页/客户财务的介绍人名同步）', async () => {
    const qc = new QueryClient()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useUpdateReferrer(), { wrapper: wrap(qc) })

    await result.current.mutateAsync({ id: 'r1', patch: { name: '新名字' } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(spy).toHaveBeenCalledWith({ queryKey: ['referrers'] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['finance', 'referrers'] }) // 关键链接修复
  })
})
