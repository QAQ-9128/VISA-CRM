import { Outlet } from 'react-router-dom'

/** 未登录页面（登录页）外壳：移动端优先的居中容器。 */
export function AuthLayout() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <Outlet />
      </div>
    </div>
  )
}
