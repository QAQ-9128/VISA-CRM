import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { FullScreenLoader } from '../components/ui/FullScreenLoader'

/** 受保护路由：会话恢复中显示加载；未登录重定向 /login（携带来源以便登录后回跳）。 */
export function ProtectedRoute() {
  const { loading, session } = useAuth()
  const location = useLocation()

  if (loading) return <FullScreenLoader />
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />

  return <Outlet />
}
