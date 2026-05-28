import { NavLink } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { LogOutIcon } from '../ui/icons'
import { NAV_ITEMS } from './navItems'

/** 桌面端左侧固定导航（md 以上显示，手机端由 BottomTabBar 取代）。 */
export function Sidebar() {
  const { profile, user, isAdmin, signOut } = useAuth()
  const items = NAV_ITEMS.filter((i) => !i.adminOnly || isAdmin)

  return (
    <aside className="hidden md:flex md:w-60 md:shrink-0 md:flex-col border-r border-slate-200 bg-white">
      <div className="px-5 py-5 text-lg font-semibold text-slate-900">签证 CRM</div>

      <nav className="flex-1 space-y-1 px-3">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`
            }
          >
            <Icon className="size-5" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-200 p-3">
        <div className="px-2 pb-2">
          <p className="truncate text-sm font-medium text-slate-800">
            {profile?.full_name || user?.email || '未登录'}
          </p>
          <p className="text-xs text-slate-400">{isAdmin ? '管理员' : '员工'}</p>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <LogOutIcon className="size-5" />
          退出登录
        </button>
      </div>
    </aside>
  )
}
