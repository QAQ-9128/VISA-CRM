import { NavLink } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { NAV_ITEMS } from './navItems'

/** 手机端底部 Tab 导航（md 以下显示）。固定在底部，内容区需留出底部 padding。 */
export function BottomTabBar() {
  const { isAdmin } = useAuth()
  const items = NAV_ITEMS.filter((i) => !i.adminOnly || isAdmin)

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line-2 bg-white/95 backdrop-blur md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex min-w-0 flex-1 flex-col items-center gap-0.5 px-0.5 py-2 font-medium transition-colors ${
              isActive ? 'text-brand' : 'text-faint'
            }`
          }
        >
          <Icon className="size-6" />
          <span className="max-w-full truncate text-[10px] leading-none">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
