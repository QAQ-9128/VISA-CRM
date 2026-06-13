import { Outlet } from 'react-router-dom'
import { Sidebar } from '../components/layout/Sidebar'
import { BottomTabBar } from '../components/layout/BottomTabBar'
import { Toaster } from '../components/ui/Toaster'
import { ShieldIcon } from '../components/ui/icons'

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
        <header className="flex items-center gap-2.5 border-b border-line-2 bg-white px-4 py-3 md:hidden">
          <span className="grid size-8 place-items-center rounded-lg bg-[linear-gradient(135deg,#4e9a6b,#2e6a48)] text-white">
            <ShieldIcon className="size-[18px]" />
          </span>
          <span className="text-base font-bold text-ink">签证 CRM</span>
        </header>
        <main className="flex-1 px-4 pt-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-8 md:pt-6 md:pb-8">
          <Outlet />
        </main>
        <BottomTabBar />
      </div>
      <Toaster />
    </div>
  )
}
