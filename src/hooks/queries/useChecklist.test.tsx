import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAddChecklistItem } from './useChecklist'

// 只 mock api 的 createChecklistItem；其余导出保留
vi.mock('../../api/checklist', async (orig) => {
  const actual = await orig<typeof import('../../api/checklist')>()
  return {
    ...actual,
    createChecklistItem: vi.fn().mockResolvedValue({ id: 'cl1', content: '无犯罪证明' }),
  }
})
import { createChecklistItem } from '../../api/checklist'

function wrapperWith(qc: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

beforeEach(() => vi.clearAllMocks())

describe('useAddChecklistItem（待补充 / 缺失提醒「+」）', () => {
  it('成功添加：以内容 + 关联客户/案件写入，并失效 checklist 列表（刷新）', async () => {
    const qc = new QueryClient()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useAddChecklistItem(), { wrapper: wrapperWith(qc) })

    await result.current.mutateAsync({ content: '无犯罪证明', customerId: 'cust1', caseId: 'case1' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // 写入带上 customer_id / case_id（这正是需要 0027 迁移的列）
    expect(createChecklistItem).toHaveBeenCalledWith('无犯罪证明', { customer_id: 'cust1', case_id: 'case1' })
    // 成功后失效 checklist 列表 → 缺失提醒即时刷新
    expect(spy).toHaveBeenCalledWith({ queryKey: ['checklist'] })
  })

  it('只挂客户（无案件）也能添加：case_id 传 null', async () => {
    const qc = new QueryClient()
    const { result } = renderHook(() => useAddChecklistItem(), { wrapper: wrapperWith(qc) })
    await result.current.mutateAsync({ content: '体检回执', customerId: 'cust1', caseId: null })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(createChecklistItem).toHaveBeenCalledWith('体检回执', { customer_id: 'cust1', case_id: null })
  })

  it('后端报错（如缺列）→ mutation 进入 error 态，可被 UI 显示真实原因', async () => {
    ;(createChecklistItem as ReturnType<typeof vi.fn>).mockRejectedValueOnce({
      message: "Could not find the 'customer_id' column of 'checklist_items' in the schema cache",
      code: 'PGRST204',
    })
    const qc = new QueryClient()
    const { result } = renderHook(() => useAddChecklistItem(), { wrapper: wrapperWith(qc) })
    result.current.mutate({ content: 'x', customerId: 'cust1', caseId: null })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as { code?: string }).code).toBe('PGRST204')
  })

  it('乐观更新：点添加立即把该条（带客户/案件归属）插入 checklist 缓存——解决加完不刷新', async () => {
    const qc = new QueryClient()
    qc.setQueryData(['checklist'], []) // 初始空列表
    const { result } = renderHook(() => useAddChecklistItem(), { wrapper: wrapperWith(qc) })

    result.current.mutate({ content: '无犯罪证明', customerId: 'cust1', caseId: 'case1' })

    // 不等待网络：onMutate 已同步把临时项写进缓存
    await waitFor(() => {
      const data = qc.getQueryData(['checklist']) as Array<{ content: string; customer_id: string | null; case_id: string | null }> | undefined
      expect(data).toHaveLength(1)
      expect(data?.[0]).toMatchObject({ content: '无犯罪证明', customer_id: 'cust1', case_id: 'case1' })
    })
  })

  it('乐观更新失败 → 回滚（缓存恢复原样）', async () => {
    ;(createChecklistItem as ReturnType<typeof vi.fn>).mockRejectedValueOnce({ code: 'PGRST204' })
    const qc = new QueryClient()
    qc.setQueryData(['checklist'], [{ id: 'old', content: '原有项', is_done: false, customer_id: null, case_id: null }])
    const { result } = renderHook(() => useAddChecklistItem(), { wrapper: wrapperWith(qc) })

    result.current.mutate({ content: '会失败', customerId: 'cust1', caseId: null })
    await waitFor(() => expect(result.current.isError).toBe(true))
    const data = qc.getQueryData(['checklist']) as Array<{ content: string }> | undefined
    expect(data?.map((i) => i.content)).toEqual(['原有项']) // 临时项已回滚
  })
})
