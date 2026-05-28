import { Outlet } from 'react-router-dom'
import { Sidebar } from '../components/layout/Sidebar'
import { BottomTabBar } from '../components/layout/BottomTabBar'

/**
 * 登录后主壳。
 * - md 以上：左侧 Sidebar + 右侧内容。
 * - md 以下：顶部标题栏 + 内容（底部留白避开 TabBar）+ 固定底部 TabBar。
 */
export function AppLayout() {
  return (
    <div className="flex min-h-svh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <span className="text-base font-semibold text-slate-900">签证 CRM</span>
        </header>
        <main className="flex-1 px-4 pt-4 pb-24 md:px-8 md:pt-6 md:pb-8">
          <Outlet />
        </main>
        <BottomTabBar />
      </div>
    </div>
  )
}
