import { Link } from 'react-router-dom'
import { useArchiveReferrer, useDeleteReferrer, useReferrers } from '../../hooks/queries/useReferrers'
import { Button } from '../../components/ui/Button'
import { LoadingBlock, ErrorBlock, EmptyState } from '../../components/ui/states'
import type { Referrer } from '../../types/models'

function ReferrerRow({ r }: { r: Referrer }) {
  const archive = useArchiveReferrer()
  const del = useDeleteReferrer()
  return (
    <li className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-slate-900">{r.name}</p>
        <p className="truncate text-sm text-slate-500">
          {[r.contact_phone, r.contact_email].filter(Boolean).join(' · ') || '—'}
        </p>
      </div>
      <Link to={`/referrers/${r.id}/edit`} className="shrink-0">
        <Button variant="secondary">编辑</Button>
      </Link>
      <button
        type="button"
        disabled={archive.isPending}
        className="shrink-0 text-xs text-slate-400 hover:text-slate-700"
        onClick={() => {
          if (window.confirm(`归档介绍人「${r.name}」？已挂靠的客户不受影响。`)) archive.mutate(r.id)
        }}
      >
        归档
      </button>
      <button
        type="button"
        disabled={del.isPending}
        className="shrink-0 text-xs text-slate-400 hover:text-rose-600"
        onClick={() => {
          if (window.confirm(`彻底删除介绍人「${r.name}」？【不可恢复】，已挂靠客户的「介绍人」将被清空。如只想隐藏请用「归档」。`))
            del.mutate(r.id)
        }}
      >
        彻底删除
      </button>
    </li>
  )
}

export function ReferrerListPage() {
  const referrers = useReferrers()

  return (
    <section className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">介绍人</h1>
        <Link to="/referrers/new">
          <Button>+ 新建介绍人</Button>
        </Link>
      </div>

      <div className="mt-4">
        {referrers.isPending ? (
          <LoadingBlock />
        ) : referrers.isError ? (
          <ErrorBlock error={referrers.error} />
        ) : referrers.data.length === 0 ? (
          <EmptyState
            title="还没有介绍人"
            action={
              <Link to="/referrers/new">
                <Button>新建第一个介绍人</Button>
              </Link>
            }
          />
        ) : (
          <ul className="rounded-xl border border-slate-200 bg-white px-3">
            {referrers.data.map((r) => (
              <ReferrerRow key={r.id} r={r} />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
