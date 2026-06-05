import { describe, expect, it, beforeEach } from 'vitest'
import { createAppQueryClient } from './queryClient'
import { useUiStore } from '../store/ui'

beforeEach(() => useUiStore.setState({ toasts: [] }))

/** 直接经 MutationCache 跑一个 mutation（不经 React），验证全局 toast 挂钩。 */
async function run(client: ReturnType<typeof createAppQueryClient>, opts: {
  mutationFn: () => Promise<unknown>
  meta?: Record<string, unknown>
}) {
  const m = client.getMutationCache().build(client, { mutationFn: opts.mutationFn, meta: opts.meta })
  try {
    await m.execute(undefined)
  } catch {
    /* onError 已由全局处理，这里吞掉让断言继续 */
  }
}

describe('createAppQueryClient · 全局 mutation 反馈', () => {
  it('meta.success 存在 → 成功后弹绿色 toast', async () => {
    const client = createAppQueryClient()
    await run(client, { mutationFn: async () => 1, meta: { success: '已记收款' } })
    expect(useUiStore.getState().toasts).toMatchObject([{ type: 'success', message: '已记收款' }])
  })

  it('无 meta.success → 成功保持安静（勾选/折叠类操作不刷屏）', async () => {
    const client = createAppQueryClient()
    await run(client, { mutationFn: async () => 1 })
    expect(useUiStore.getState().toasts).toHaveLength(0)
  })

  it('任何 mutation 失败 → 红色 toast 带真实错误信息（不再静默失败）', async () => {
    const client = createAppQueryClient()
    await run(client, { mutationFn: async () => { throw new Error('row violates RLS') } })
    const ts = useUiStore.getState().toasts
    expect(ts).toHaveLength(1)
    expect(ts[0].type).toBe('error')
    expect(ts[0].message).toContain('row violates RLS')
  })

  it('meta.errorPrefix → 错误文案带业务前缀', async () => {
    const client = createAppQueryClient()
    await run(client, {
      mutationFn: async () => { throw new Error('network down') },
      meta: { errorPrefix: '记收款失败' },
    })
    expect(useUiStore.getState().toasts[0].message).toBe('记收款失败：network down')
  })
})
