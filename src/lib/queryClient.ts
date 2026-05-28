import { QueryClient } from '@tanstack/react-query'

/**
 * 全局 TanStack Query 客户端。
 * - staleTime 30s：避免页面切换频繁重拉；实时更新由 useCaseRealtime 主动失效缓存补足。
 * - retry 1：内部工具，失败快速反馈优于反复重试。
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})
