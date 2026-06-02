import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRightIcon } from './icons'

/** 大圆角白卡（设计系统卡壳）。pad=false 时去内边距（表格卡用）。 */
export function Card({
  className = '',
  pad = true,
  children,
}: {
  className?: string
  pad?: boolean
  children: ReactNode
}) {
  return (
    <section className={`rounded-card bg-white shadow-soft ${pad ? 'p-[22px]' : ''} ${className}`}>
      {children}
    </section>
  )
}

/** 卡头：标题(16/700) + 可选副标 + 右侧操作（链接或任意节点）。 */
export function CardHead({
  title,
  sub,
  link,
  action,
  className = '',
}: {
  title: ReactNode
  sub?: ReactNode
  link?: { to: string; label: string }
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={`mb-4 flex items-center justify-between gap-3.5 ${className}`}>
      <div className="min-w-0">
        <h3 className="text-base font-bold tracking-[-0.01em] text-ink">{title}</h3>
        {sub != null && <div className="mt-[3px] text-[12.5px] text-faint">{sub}</div>}
      </div>
      {action ??
        (link && (
          <Link
            to={link.to}
            className="flex shrink-0 items-center gap-0.5 text-[13px] font-semibold text-brand hover:text-brand-600"
          >
            {link.label} <ChevronRightIcon className="size-3.5" />
          </Link>
        ))}
    </div>
  )
}
