import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-5xl font-bold text-slate-300">404</p>
      <p className="text-slate-600">页面不存在</p>
      <Link to="/" className="text-sm font-medium text-indigo-600 hover:underline">
        返回概览
      </Link>
    </div>
  )
}
