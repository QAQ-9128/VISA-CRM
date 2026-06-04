/**
 * 全局「从哪进来就返回哪」：
 *  - deriveBackSource(pathname)：按当前路由推导一个来源标记对象，作为 Link 的 state 传给详情页。
 *    用路由而非写死，复用组件（如 ReceivablesTable 同时在财务页和客户详情页）也能自动带对正确来源。
 *  - resolveBackLink(state, fallback)：详情页据 state.from 算出返回目标 { to, label }；
 *    state 丢失（刷新/新标签/分享链接）时回落 fallback。不依赖浏览器 history。
 */
export interface BackTarget {
  to: string
  label: string
}

export interface BackSource {
  from?: string
  /** 来源是某个具体客户详情时的客户 id */
  customerId?: string
  /** 来源是某个具体案件详情时的案件 id */
  caseId?: string
  /** 案件区来源 tab（'lodge' = 递交进度） */
  view?: string
}

/** 固定区域（列表/首页）→ 返回目标。 */
const AREA: Record<string, BackTarget> = {
  dashboard: { to: '/', label: '返回概览' },
  customers: { to: '/customers', label: '返回客户列表' },
  cases: { to: '/cases', label: '返回递交进度' },
  finance: { to: '/finance', label: '返回财务' },
  archive: { to: '/storage', label: '返回档案库' },
  employers: { to: '/employers', label: '返回雇主' },
  referrers: { to: '/referrers', label: '返回介绍人' },
}

/** 当前路由 → 来源标记（传给详情页 Link 的 state）。 */
export function deriveBackSource(pathname: string): BackSource {
  if (pathname === '/') return { from: 'dashboard' }
  if (pathname === '/customers') return { from: 'customers' }
  if (pathname === '/finance') return { from: 'finance' }
  if (pathname === '/storage') return { from: 'archive' }
  if (pathname === '/employers') return { from: 'employers' }
  if (pathname === '/referrers') return { from: 'referrers' }
  if (pathname === '/cases') return { from: 'cases' } // 递交进度（案件列表/详情页已删）
  const cust = /^\/customers\/([^/]+)$/.exec(pathname)
  if (cust) return { from: 'customer', customerId: cust[1] }
  return {}
}

/**
 * 应用内是否有可后退的历史：react-router 的 browser router 在 history.state.idx 记录
 * 本会话内的导航序号（首页 = 0）。idx > 0 ⇒ 真·后退一定还落在应用内（精确回到原界面，
 * 含筛选/tab/滚动位置）；否则（刷新后首条/直链/新标签）后退可能离开应用 → 走 fallback。
 */
export function canGoBackInApp(
  historyState: unknown = typeof window !== 'undefined' ? window.history.state : null,
): boolean {
  const idx = (historyState as { idx?: unknown } | null)?.idx
  return typeof idx === 'number' && idx > 0
}

/** 来源标记 → 返回目标；未知/缺失回落 fallback。 */
export function resolveBackLink(state: unknown, fallback: BackTarget): BackTarget {
  const s = (state ?? {}) as BackSource
  switch (s.from) {
    case 'customer':
      return s.customerId ? { to: `/customers/${s.customerId}`, label: '返回客户档案' } : fallback
    case 'case':
      // 案件详情页已删：旧 state 兜底回递交进度
      return { to: '/cases', label: '返回递交进度' }
    default:
      return (s.from && AREA[s.from]) || fallback
  }
}
