import type { ReactNode } from 'react'

/** Phase 1 占位页统一外观；后续阶段逐页替换为真实内容。 */
export function PagePlaceholder({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children?: ReactNode
}) {
  return (
    <section className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      <div className="flex flex-col items-center gap-2 rounded-card bg-white px-4 py-14 text-center shadow-soft">
        <div className="grid size-14 place-items-center rounded-[18px] bg-surface-2 text-3xl">🚧</div>
        <p className="text-sm text-faint">{children ?? '此页面将在后续阶段实现'}</p>
      </div>
    </section>
  )
}
