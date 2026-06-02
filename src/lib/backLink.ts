/**
 * 全局「从哪进来就返回哪」：
 *  - deriveBackSource(pathname, search)：按当前路由推导一个来源标记对象，作为 Link 的 state 传给详情页。
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
  customers: { to: '/customers', label: '返回客户' },
  cases: { to: '/cases', label: '返回案件' },
  finance: { to: '/finance', label: '返回财务' },
  archive: { to: '/storage', label: '返回档案库' },
  employers: { to: '/employers', label: '返回雇主' },
  referrers: { to: '/referrers', label: '返回介绍人' },
}

/** 当前路由 → 来源标记（传给详情页 Link 的 state）。 */
export function deriveBackSource(pathname: string, search = ''): BackSource {
  if (pathname === '/') return { from: 'dashboard' }
  if (pathname === '/customers') return { from: 'customers' }
  if (pathname === '/finance') return { from: 'finance' }
  if (pathname === '/storage') return { from: 'archive' }
  if (pathname === '/employers') return { from: 'employers' }
  if (pathname === '/referrers') return { from: 'referrers' }
  if (pathname === '/cases') {
    const view = new URLSearchParams(search).get('view')
    return view === 'lodge' ? { from: 'cases', view: 'lodge' } : { from: 'cases' }
  }
  const cust = /^\/customers\/([^/]+)$/.exec(pathname)
  if (cust) return { from: 'customer', customerId: cust[1] }
  const cas = /^\/cases\/([^/]+)$/.exec(pathname)
  if (cas) return { from: 'case', caseId: cas[1] }
  return {}
}

/** 来源标记 → 返回目标；未知/缺失回落 fallback。 */
export function resolveBackLink(state: unknown, fallback: BackTarget): BackTarget {
  const s = (state ?? {}) as BackSource
  switch (s.from) {
    case 'cases':
      return s.view === 'lodge'
        ? { to: '/cases?view=lodge', label: '返回递交进度' }
        : { to: '/cases', label: '返回案件' }
    case 'customer':
      return s.customerId ? { to: `/customers/${s.customerId}`, label: '返回客户档案' } : fallback
    case 'case':
      return s.caseId ? { to: `/cases/${s.caseId}`, label: '返回案件' } : fallback
    default:
      return (s.from && AREA[s.from]) || fallback
  }
}
