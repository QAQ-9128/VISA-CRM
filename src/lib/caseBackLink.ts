/**
 * 案件详情页「返回」按钮的目标 + 文案，按来源(location.state.from)优先级派生。纯函数。
 *
 * 不变量：
 *  - 永远返回可点击目标——state 丢失/未知时用案件自带 customer_id 兜底（NOT NULL 外键，URL 必存在）；
 *  - 不依赖浏览器 history——刷新/新标签/分享链接都正确；
 *  - 与浏览器后退共存——这是一个普通链接，不调用 history.back。
 */
export interface CaseBackLink {
  to: string
  label: string
}

interface CaseBackState {
  from?: string
  customerId?: string
}

export function resolveCaseBackLink(state: unknown, caseCustomerId: string): CaseBackLink {
  const s = (state ?? {}) as CaseBackState
  const fallback: CaseBackLink = { to: `/customers/${caseCustomerId}`, label: '返回客户档案' }

  switch (s.from) {
    case 'customer':
      // 缺 customerId（防御性）→ 兜底到案件自带 customer_id
      return s.customerId ? { to: `/customers/${s.customerId}`, label: '返回客户档案' } : fallback
    case 'cases':
      return { to: '/cases', label: '递交进度' }
    case 'dashboard':
      return { to: '/', label: '返回仪表板' }
    case 'finance':
      return { to: '/finance', label: '返回财务' }
    case 'archive':
      return { to: '/storage', label: '返回档案库' }
    default:
      return fallback
  }
}
