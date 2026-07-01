import { Outlet } from 'react-router-dom'

/** 未登录外壳：登录页自带全屏分栏布局，这里仅做直通容器。 */
export function AuthLayout() {
  return <Outlet />
}
