import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-canvas px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-card bg-white px-6 py-12 text-center shadow-soft">
        <div className="grid size-16 place-items-center rounded-[20px] bg-surface-2 text-4xl">🧭</div>
        <p className="text-3xl font-bold tracking-[-0.02em] text-ink">404</p>
        <p className="text-sm text-muted">页面不存在</p>
        <Link
          to="/"
          className="mt-2 inline-flex min-h-11 items-center justify-center rounded-full bg-brand px-5 text-sm font-semibold text-white shadow-brand transition-colors hover:bg-brand-600"
        >
          返回概览
        </Link>
      </div>
    </div>
  )
}
