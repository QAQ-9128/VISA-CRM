import { Link } from 'react-router-dom'
import { useArchiveEmployer, useDeleteEmployer, useEmployers } from '../../hooks/queries/useEmployers'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Well } from '../../components/ui/Well'
import { BuildingIcon, PlusIcon } from '../../components/ui/icons'
import { LoadingBlock, ErrorBlock, EmptyState } from '../../components/ui/states'
import type { Employer } from '../../types/models'

function EmployerRow({ e }: { e: Employer }) {
  const archive = useArchiveEmployer()
  const del = useDeleteEmployer()
  return (
    <li className="flex min-h-12 items-center gap-3 border-t border-line py-3 first:border-t-0">
      <Well tone="indigo" size={42}>
        <BuildingIcon className="size-[22px]" />
      </Well>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{e.name}</p>
        <p className="truncate text-xs text-faint">
          {[e.abn && `ABN ${e.abn}`, e.contact_name, e.contact_phone].filter(Boolean).join(' · ') || '—'}
        </p>
      </div>
      <Link to={`/employers/${e.id}/edit`} className="shrink-0">
        <Button variant="secondary">编辑</Button>
      </Link>
      <button
        type="button"
        disabled={archive.isPending}
        className="shrink-0 text-xs text-faint hover:text-body"
        onClick={() => {
          if (window.confirm(`归档雇主「${e.name}」？已挂靠的客户不受影响。`)) archive.mutate(e.id)
        }}
      >
        归档
      </button>
      <button
        type="button"
        disabled={del.isPending}
        className="shrink-0 text-xs text-faint hover:text-rose-600"
        onClick={() => {
          if (window.confirm(`彻底删除雇主「${e.name}」？【不可恢复】，已挂靠客户的「担保雇主」将被清空。如只想隐藏请用「归档」。`))
            del.mutate(e.id)
        }}
      >
        彻底删除
      </button>
    </li>
  )
}

export function EmployerListPage() {
  const employers = useEmployers()

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">担保雇主</h1>
        <Link to="/employers/new">
          <Button>
            <PlusIcon className="size-[18px]" /> 新建雇主
          </Button>
        </Link>
      </div>

      {employers.isPending ? (
        <LoadingBlock />
      ) : employers.isError ? (
        <ErrorBlock error={employers.error} />
      ) : employers.data.length === 0 ? (
        <EmptyState
          title="还没有担保雇主"
          icon="🏢"
          action={
            <Link to="/employers/new">
              <Button>新建第一个雇主</Button>
            </Link>
          }
        />
      ) : (
        <Card>
          <ul>
            {employers.data.map((e) => (
              <EmployerRow key={e.id} e={e} />
            ))}
          </ul>
        </Card>
      )}
    </section>
  )
}
