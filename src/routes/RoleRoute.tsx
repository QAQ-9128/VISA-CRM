import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import { FullScreenLoader } from '../components/ui/FullScreenLoader'
import type { AppRole } from '../types/domain'

/** 角色守卫：profile 加载中显示加载；角色不符重定向首页。包裹需要特定角色的页面。 */
export function RoleRoute({ role, children }: { role: AppRole; children: ReactNode }) {
  const { loading, profile } = useAuth()

  if (loading) return <FullScreenLoader />
  if (profile?.role !== role) return <Navigate to="/" replace />

  return <>{children}</>
}
