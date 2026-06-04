import { Link, useNavigate } from 'react-router-dom'
import { canGoBackInApp } from '../../lib/backLink'

/**
 * 详情页左上角返回入口（移动端同样可见）。
 * 应用内有历史 → 真·后退（精确回到点进来的那个界面，含筛选/tab）；
 * 否则（刷新/直链/新标签）→ 按 to 兜底（resolveBackLink 或调用方写的回退目标）。
 */
export function BackLink({ to, label }: { to: string; label: string }) {
  const navigate = useNavigate()
  return (
    <Link
      to={to}
      onClick={(e) => {
        if (canGoBackInApp()) {
          e.preventDefault()
          navigate(-1)
        }
      }}
      className="-ml-1 inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-800"
    >
      <span aria-hidden>←</span> {label}
    </Link>
  )
}
