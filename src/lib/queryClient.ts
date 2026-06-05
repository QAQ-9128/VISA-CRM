import { MutationCache, QueryClient } from '@tanstack/react-query'
import { toastError, toastSuccess } from '../store/ui'
import { errorMessage } from './errorMessage'

/**
 * 全局 TanStack Query 客户端。
 * - staleTime 30s：避免页面内切换频繁重拉；App 内的增删改通过 mutation 主动失效缓存即时同步。
 * - refetchOnWindowFocus true：切回本标签页时自动重拉过期数据，使在 Supabase 后台等处的
 *   带外改动（删/改）在切回来时也能同步（受 staleTime 约束，30s 内的快速切换不会重复拉）。
 * - retry 1：内部工具，失败快速反馈优于反复重试。
 *
 * 全局 mutation 反馈（MutationCache 挂钩）：
 * - 失败 → 一律红 toast 带真实错误（终结静默失败）；meta.errorPrefix 可加业务前缀。
 * - 成功 → 仅当 mutation 声明了 meta.success 文案才弹绿 toast（勾选/折叠类高频操作保持安静）。
 */
export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    mutationCache: new MutationCache({
      onSuccess: (_data, _vars, _ctx, mutation) => {
        const msg = mutation.meta?.success
        if (typeof msg === 'string' && msg) toastSuccess(msg)
      },
      onError: (error, _vars, _ctx, mutation) => {
        const prefix = mutation.meta?.errorPrefix
        const detail = errorMessage(error) ?? '请重试'
        toastError(typeof prefix === 'string' && prefix ? `${prefix}：${detail}` : detail)
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: 0,
      },
    },
  })
}

export const queryClient = createAppQueryClient()
