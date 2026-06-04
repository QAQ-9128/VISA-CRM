import { useNavigate } from 'react-router-dom'
import { canGoBackInApp } from '../lib/backLink'

/**
 * 「从哪来回哪去」的统一返回/取消：应用内有历史 → 真·后退（navigate(-1)，
 * 精确回到上一个界面，含筛选/tab）；否则（刷新/直链进入）→ 跳 fallback 兜底。
 * 表单页的「取消」按钮统一用这个。
 */
export function useSmartBack(fallbackTo: string): () => void {
  const navigate = useNavigate()
  return () => {
    if (canGoBackInApp()) navigate(-1)
    else navigate(fallbackTo)
  }
}
