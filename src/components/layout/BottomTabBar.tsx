import { NavLink } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { NAV_ITEMS } from './navItems'

/** 手机端底部 Tab 导航（md 以下显示）。固定在底部，内容区需留出底部 padding。 */
export function BottomTabBar() {
  const { isAdmin } = useAuth()
  const items = NAV_ITEMS.filter((i) => !i.adminOnly || isAdmin)

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white/95 backdrop-blur md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors ${
              isActive ? 'text-indigo-600' : 'text-slate-500'
            }`
          }
        >
          <Icon className="size-6" />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
