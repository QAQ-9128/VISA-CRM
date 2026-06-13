import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { MoreIcon } from '../ui/icons'
import { NAV_ITEMS } from './navItems'

const tabCls = (active: boolean) =>
  `flex min-w-0 flex-1 flex-col items-center gap-0.5 px-0.5 py-2 font-medium transition-colors ${
    active ? 'text-brand' : 'text-faint'
  }`

/**
 * 手机端底部 Tab 导航（md 以下显示）。固定在底部，内容区留出底部 padding。
 * 只放日常高频项（primary）；其余（雇主/介绍人/所属账号/账号管理）收进「更多」溢出菜单，
 * 避免一排塞 8-9 项在 375px 下标签被挤到截断。
 */
export function BottomTabBar() {
  const { isAdmin } = useAuth()
  const { pathname } = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)

  const items = NAV_ITEMS.filter((i) => !i.adminOnly || isAdmin)
  const primary = items.filter((i) => i.primary)
  const overflow = items.filter((i) => !i.primary)
  // 当前在溢出页时高亮「更多」
  const overflowActive = overflow.some((i) => pathname === i.to || pathname.startsWith(`${i.to}/`))

  return (
    <>
      {/* 「更多」打开时的全屏点击遮罩（点空白关闭） */}
      {moreOpen && (
        <div className="fixed inset-0 z-30 bg-ink/20 md:hidden" onClick={() => setMoreOpen(false)} aria-hidden />
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {/* 溢出菜单：贴在 TabBar 上方，竖排列出其余入口 */}
        {moreOpen && overflow.length > 0 && (
          <div className="mx-2 mb-1.5 overflow-hidden rounded-2xl border border-line-2 bg-white shadow-soft">
            {overflow.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  `flex min-h-12 items-center gap-3 px-4 text-sm font-medium transition-colors ${
                    isActive ? 'bg-brand-50 text-brand' : 'text-body hover:bg-surface-2'
                  }`
                }
              >
                <Icon className="size-5" />
                {label}
              </NavLink>
            ))}
          </div>
        )}

        <nav className="flex border-t border-line-2 bg-white/95 backdrop-blur">
          {primary.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setMoreOpen(false)}
              className={({ isActive }) => tabCls(isActive)}
            >
              <Icon className="size-6" />
              <span className="max-w-full truncate text-[10px] leading-none">{label}</span>
            </NavLink>
          ))}
          {overflow.length > 0 && (
            <button
              type="button"
              aria-label="更多"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((o) => !o)}
              className={tabCls(overflowActive || moreOpen)}
            >
              <MoreIcon className="size-6" />
              <span className="max-w-full truncate text-[10px] leading-none">更多</span>
            </button>
          )}
        </nav>
      </div>
    </>
  )
}
