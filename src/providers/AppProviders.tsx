import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { queryClient } from '../lib/queryClient'
import { router } from '../routes'
import { AuthProvider } from './AuthProvider'

/**
 * 应用根 Provider 组合：服务端状态(Query) → 认证(Auth) → 路由。
 * 路由内的守卫依赖 useAuth，故 RouterProvider 必须在 AuthProvider 之内。
 */
export function AppProviders() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  )
}
