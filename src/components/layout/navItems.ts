import type { ComponentType, SVGProps } from 'react'
import {
  ArchiveIcon,
  BriefcaseIcon,
  BuildingIcon,
  ClipboardIcon,
  HomeIcon,
  ShieldIcon,
  UserPlusIcon,
  UsersIcon,
  WalletIcon,
} from '../ui/icons'

export interface NavItem {
  to: string
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  /** 仅 admin 可见 */
  adminOnly?: boolean
  /** NavLink end 匹配（用于首页 "/" 精确匹配） */
  end?: boolean
  /** 移动端底部导航栏直接显示（日常高频）；其余归入「更多」溢出菜单 */
  primary?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: '概览', icon: HomeIcon, end: true, primary: true },
  { to: '/customers', label: '客户列表', icon: UsersIcon, primary: true },
  { to: '/cases', label: '递交进度', icon: BriefcaseIcon, primary: true },
  { to: '/finance', label: '财务', icon: WalletIcon, primary: true },
  { to: '/employers', label: '雇主', icon: BuildingIcon },
  { to: '/referrers', label: '介绍人', icon: UserPlusIcon },
  { to: '/immi-accounts', label: '所属账号', icon: ClipboardIcon },
  { to: '/storage', label: '档案库', icon: ArchiveIcon, primary: true },
  { to: '/admin/users', label: '账号', icon: ShieldIcon, adminOnly: true },
]
