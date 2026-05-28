import type { ComponentType, SVGProps } from 'react'
import { BriefcaseIcon, BuildingIcon, HomeIcon, ShieldIcon, UsersIcon } from '../ui/icons'

export interface NavItem {
  to: string
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  /** 仅 admin 可见 */
  adminOnly?: boolean
  /** NavLink end 匹配（用于首页 "/" 精确匹配） */
  end?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: '概览', icon: HomeIcon, end: true },
  { to: '/customers', label: '客户', icon: UsersIcon },
  { to: '/cases', label: '案件', icon: BriefcaseIcon },
  { to: '/employers', label: '雇主', icon: BuildingIcon },
  { to: '/admin/users', label: '账号', icon: ShieldIcon, adminOnly: true },
]
