import { useLocation } from 'react-router-dom'
import { deriveBackSource } from '../lib/backLink'
import type { BackSource } from '../lib/backLink'

/**
 * 当前路由对应的「来源标记」，作为进详情页 Link 的 state，实现「从哪进来就返回哪」。
 * 用路由推导而非写死，故同一组件在不同页面复用时也能带对来源。
 */
export function useBackSource(): BackSource {
  const loc = useLocation()
  return deriveBackSource(loc.pathname, loc.search)
}
