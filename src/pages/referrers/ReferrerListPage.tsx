import { Link } from 'react-router-dom'
import { useArchiveReferrer, useDeleteReferrer, useReferrers } from '../../hooks/queries/useReferrers'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Well } from '../../components/ui/Well'
import { UserPlusIcon, PlusIcon } from '../../components/ui/icons'
import { LoadingBlock, ErrorBlock, EmptyState } from '../../components/ui/states'
import type { Referrer } from '../../types/models'

function ReferrerRow({ r }: { r: Referrer }) {
  const archive = useArchiveReferrer()
  const del = useDeleteReferrer()
  return (
    <li className="flex min-h-12 items-center gap-3 border-t border-line py-3 first:border-t-0">
      <Well tone="violet" size={42}>
        <UserPlusIcon className="size-[22px]" />
      </Well>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{r.name}</p>
        <p className="truncate text-xs text-faint">
          {[r.contact_phone, r.contact_email].filter(Boolean).join(' · ') || '—'}
        </p>
      </div>
      <Link to={`/referrers/${r.id}/edit`} className="shrink-0">
        <Button variant="secondary">编辑</Button>
      </Link>
      <button
        type="button"
        disabled={archive.isPending}
        className="shrink-0 text-xs text-faint hover:text-body"
        onClick={() => {
          if (window.confirm(`归档介绍人「${r.name}」？已挂靠的客户不受影响。`)) archive.mutate(r.id)
        }}
      >
        归档
      </button>
      <button
        type="button"
        disabled={del.isPending}
        className="shrink-0 text-xs text-faint hover:text-rose-600"
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
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">介绍人</h1>
        <Link to="/referrers/new">
          <Button>
            <PlusIcon className="size-[18px]" /> 新建介绍人
          </Button>
        </Link>
      </div>

      {referrers.isPending ? (
        <LoadingBlock />
      ) : referrers.isError ? (
        <ErrorBlock error={referrers.error} />
      ) : referrers.data.length === 0 ? (
        <EmptyState
          title="还没有介绍人"
          icon="🤝"
          action={
            <Link to="/referrers/new">
              <Button>新建第一个介绍人</Button>
            </Link>
          }
        />
      ) : (
        <Card>
          <ul>
            {referrers.data.map((r) => (
              <ReferrerRow key={r.id} r={r} />
            ))}
          </ul>
        </Card>
      )}
    </section>
  )
}
