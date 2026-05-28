import { Link } from 'react-router-dom'
import { useArchiveEmployer, useEmployers } from '../../hooks/queries/useEmployers'
import { Button } from '../../components/ui/Button'
import { LoadingBlock, ErrorBlock, EmptyState } from '../../components/ui/states'
import type { Employer } from '../../types/models'

function EmployerRow({ e }: { e: Employer }) {
  const archive = useArchiveEmployer()
  return (
    <li className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-slate-900">{e.name}</p>
        <p className="truncate text-sm text-slate-500">
          {[e.abn && `ABN ${e.abn}`, e.contact_name, e.contact_phone].filter(Boolean).join(' · ') || '—'}
        </p>
      </div>
      <Link to={`/employers/${e.id}/edit`} className="shrink-0">
        <Button variant="secondary">编辑</Button>
      </Link>
      <button
        type="button"
        disabled={archive.isPending}
        className="shrink-0 text-xs text-slate-400 hover:text-rose-600"
        onClick={() => {
          if (window.confirm(`归档雇主「${e.name}」？已挂靠的客户不受影响。`)) archive.mutate(e.id)
        }}
      >
        归档
      </button>
    </li>
  )
}

export function EmployerListPage() {
  const employers = useEmployers()

  return (
    <section className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">担保雇主</h1>
        <Link to="/employers/new">
          <Button>+ 新建雇主</Button>
        </Link>
      </div>

      <div className="mt-4">
        {employers.isPending ? (
          <LoadingBlock />
        ) : employers.isError ? (
          <ErrorBlock error={employers.error} />
        ) : employers.data.length === 0 ? (
          <EmptyState
            title="还没有担保雇主"
            action={
              <Link to="/employers/new">
                <Button>新建第一个雇主</Button>
              </Link>
            }
          />
        ) : (
          <ul className="rounded-xl border border-slate-200 bg-white px-3">
            {employers.data.map((e) => (
              <EmployerRow key={e.id} e={e} />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
