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
    <section className="mx-auto max-w-5xl">
      <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">{title}</h1>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
        {children ?? '此页面将在后续阶段实现'}
      </div>
    </section>
  )
}
