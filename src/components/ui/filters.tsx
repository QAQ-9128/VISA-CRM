import type { ReactNode } from 'react'

/** 漏斗图标（筛选）。 */
export function FunnelIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 5h18l-7 8v6l-4 2v-8z" />
    </svg>
  )
}

/** 「筛选」开关按钮：高亮表示展开或已有选中，带选中计数角标。 */
export function FilterButton({
  active,
  count,
  onClick,
}: {
  active: boolean
  count: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors ${
        active
          ? 'border-brand bg-brand-50 text-brand'
          : 'border-line-2 bg-white text-body shadow-xs hover:bg-surface-2'
      }`}
    >
      <FunnelIcon className="size-[18px]" />
      筛选
      {count > 0 && (
        <span className="grid min-w-5 place-items-center rounded-full bg-brand px-1.5 text-xs font-bold text-white">
          {count}
        </span>
      )}
    </button>
  )
}

/** 可点选筛选标签（选中=品牌实心）。 */
export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13.5px] font-semibold transition-colors ${
        active ? 'bg-brand text-white shadow-xs' : 'bg-surface-2 text-body hover:bg-line-2'
      }`}
    >
      {children}
    </button>
  )
}

/** 一组筛选项：左侧标签（最小 64px 对齐，长标签如「客户归属人」不折行）+ 可换行的 chip 群。 */
export function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="min-w-16 shrink-0 text-[13.5px] font-bold whitespace-nowrap text-muted">{label}</span>
      {children}
    </div>
  )
}
