import { QueryClient } from '@tanstack/react-query'

/**
 * 全局 TanStack Query 客户端。
 * - staleTime 30s：避免页面内切换频繁重拉；App 内的增删改通过 mutation 主动失效缓存即时同步。
 * - refetchOnWindowFocus true：切回本标签页时自动重拉过期数据，使在 Supabase 后台等处的
 *   带外改动（删/改）在切回来时也能同步（受 staleTime 约束，30s 内的快速切换不会重复拉）。
 * - retry 1：内部工具，失败快速反馈优于反复重试。
 */
export const queryClient = new QueryClient({
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
