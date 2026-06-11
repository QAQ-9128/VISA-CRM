import type { ReactNode } from 'react'

/** 小标签/徽章。className 传入配色（如 lib/statusColor 的 stageBadgeClass(...)）。 */
export function Badge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        className || 'bg-slate-100 text-slate-700'
      }`}
    >
      {children}
    </span>
  )
}
