import type { ReactNode } from 'react'

/** 列表/详情加载中占位 */
export function LoadingBlock({ label = '加载中…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-faint">
      <span className="size-5 animate-spin rounded-full border-2 border-line-2 border-t-brand" />
      {label}
    </div>
  )
}

/** 加载失败提示 */
export function ErrorBlock({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : '加载失败'
  return (
    <div className="rounded-card bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 shadow-soft">
      {msg}
    </div>
  )
}

/** 空状态：居中 emoji/图标 + 标题 + 可选操作。 */
export function EmptyState({
  title,
  hint,
  icon = '📭',
  action,
}: {
  title: string
  hint?: string
  icon?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card bg-white px-4 py-14 text-center shadow-soft">
      <div className="grid size-14 place-items-center rounded-[18px] bg-surface-2 text-3xl">{icon}</div>
      <p className="mt-1 text-base font-semibold text-ink">{title}</p>
      {hint && <p className="max-w-sm text-sm text-faint">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
