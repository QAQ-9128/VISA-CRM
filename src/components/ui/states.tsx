import type { ReactNode } from 'react'

/** 列表/详情加载中占位 */
export function LoadingBlock({ label = '加载中…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400">
      <span className="size-5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500" />
      {label}
    </div>
  )
}

/** 加载失败提示 */
export function ErrorBlock({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : '加载失败'
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {msg}
    </div>
  )
}

/** 空状态 */
export function EmptyState({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center">
      <p className="text-sm text-slate-500">{title}</p>
      {action}
    </div>
  )
}
