import { NavLink } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { LogOutIcon, ShieldIcon } from '../ui/icons'
import { Avatar } from '../ui/Avatar'
import { NAV_ITEMS } from './navItems'

/** 桌面端左侧固定导航（md 以上显示，手机端由 BottomTabBar 取代）。 */
export function Sidebar() {
  const { profile, user, isAdmin, signOut } = useAuth()
  const items = NAV_ITEMS.filter((i) => !i.adminOnly || isAdmin)
  const name = profile?.full_name?.trim()

  return (
    <aside className="hidden border-r border-line-2 bg-white md:flex md:w-[232px] md:shrink-0 md:flex-col md:p-4">
      {/* 品牌区 */}
      <div className="flex items-center gap-3 px-2.5 pt-1.5 pb-5">
        <span className="grid size-[38px] place-items-center rounded-xl bg-[linear-gradient(135deg,#4e9a6b,#2e6a48)] text-white shadow-brand">
          <ShieldIcon className="size-[21px]" />
        </span>
        <div className="min-w-0">
          <div className="truncate text-base font-bold text-ink">签证 CRM</div>
          <div className="text-[11px] text-faint">移民事务工作台</div>
        </div>
      </div>

      <nav className="flex flex-col gap-[3px]">
        <div className="px-3 pt-3.5 pb-1.5 text-[11px] font-semibold tracking-[0.08em] text-faint uppercase">主菜单</div>
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex h-11 items-center gap-3 rounded-[13px] px-3.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-brand text-white shadow-brand' : 'text-muted hover:bg-surface-2 hover:text-body'
              }`
            }
          >
            <Icon className="size-[21px]" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* 底部用户卡 + 退出 */}
      <div className="mt-auto flex items-center gap-2.5 rounded-[14px] bg-surface-2 p-3">
        <Avatar name={name || user?.email || '用户'} seed={user?.id} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-ink">{name || user?.email || '未登录'}</p>
          <p className="text-[11px] text-faint">{isAdmin ? '管理员' : '员工'}</p>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          aria-label="退出登录"
          className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-white hover:text-ink"
        >
          <LogOutIcon className="size-[18px]" />
        </button>
      </div>
    </aside>
  )
}
