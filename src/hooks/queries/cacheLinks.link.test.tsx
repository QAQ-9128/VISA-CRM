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
vi.mock('../../api/cases', async (orig) => {
  const actual = await orig<typeof import('../../api/cases')>()
  return {
    ...actual,
    updateCaseStage: vi.fn().mockResolvedValue({ id: 'ca1', current_stage: 'granted' }),
    deleteLatestStageHistory: vi.fn().mockResolvedValue('nomination_approved'),
  }
})
vi.mock('../../api/lodgements', async (orig) => {
  const actual = await orig<typeof import('../../api/lodgements')>()
  return { ...actual, ensureLodgement: vi.fn().mockResolvedValue(undefined) }
})

import { useAddDocument, useArchiveDocument, useUpdateDocument } from './useDocuments'
import { useDeleteArchiveFile } from './useArchive'
import { useUpdateReferrer } from './useReferrers'
import { useUpdateCaseStage, useDeleteStageHistory } from './useCases'
import type { CaseStageHistory } from '../../types/models'

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

describe('阶段 ↔ 概览/递交进度 同源链接（改阶段即改 current_stage，处处随之重算）', () => {
  it('推进阶段 → 失效 cases 前缀 + dashboard.activeCases + 该案阶段历史 + 递交(byCase/lodged)', async () => {
    const qc = new QueryClient()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useUpdateCaseStage(), { wrapper: wrap(qc) })

    await result.current.mutateAsync({ caseId: 'ca1', fromStage: 'nomination_approved', toStage: 'granted', note: null, effectiveAt: null })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(spy).toHaveBeenCalledWith({ queryKey: ['cases'] }) // 案件详情/递交进度表/看板 同步
    expect(spy).toHaveBeenCalledWith({ queryKey: ['dashboard', 'activeCases'] }) // 概览/财务/待办清单（关键跨命名空间链接）
    expect(spy).toHaveBeenCalledWith({ queryKey: ['cases', 'stageHistory', 'ca1'] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['lodgements', 'byCase', 'ca1'] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['lodgements', 'lodged'] })
  })

  it('删最新一条流转（回退一步、重算 current_stage）→ 同样失效 cases + dashboard.activeCases + 阶段历史 + 递交', async () => {
    const qc = new QueryClient()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useDeleteStageHistory('ca1'), { wrapper: wrap(qc) })

    const row = {
      id: 'h1', case_id: 'ca1', from_stage: 'nomination_approved', to_stage: 'granted',
      note: null, changed_by: null, changed_at: '2026-05-01T00:00:00Z', effective_at: '2026-05-01T00:00:00Z',
    } as CaseStageHistory
    await result.current.mutateAsync(row)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(spy).toHaveBeenCalledWith({ queryKey: ['cases', 'stageHistory', 'ca1'] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['cases'] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['dashboard', 'activeCases'] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['lodgements', 'byCase', 'ca1'] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['lodgements', 'lodged'] })
  })
})
