import { Link } from 'react-router-dom'

/** 详情页左上角返回入口（移动端同样可见）。 */
export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="-ml-1 inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-800"
    >
      <span aria-hidden>←</span> {label}
    </Link>
  )
}
