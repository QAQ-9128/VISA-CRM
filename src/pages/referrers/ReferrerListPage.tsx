import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useArchiveReferrer, useDeleteReferrer, useReferrers } from '../../hooks/queries/useReferrers'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Well } from '../../components/ui/Well'
import { UserPlusIcon, PlusIcon } from '../../components/ui/icons'
import { LoadingBlock, ErrorBlock, EmptyState } from '../../components/ui/states'
import { REFERRER_KIND_LABELS } from '../../types/domain'
import type { ReferrerKind } from '../../types/domain'
import type { Referrer } from '../../types/models'

function ReferrerRow({ r, kindLabel }: { r: Referrer; kindLabel: string }) {
  const archive = useArchiveReferrer()
  const del = useDeleteReferrer()
  // 0031 起彻底删除全员开放（两位用户均 staff，2026-06 拍板）；防误删靠红色确认弹窗
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
          if (window.confirm(`归档${kindLabel}「${r.name}」？已挂靠的客户不受影响。`)) archive.mutate(r.id)
        }}
      >
        归档
      </button>
        <button
          type="button"
          disabled={del.isPending}
          className="shrink-0 text-xs text-faint hover:text-rose-600"
          onClick={() => {
            if (window.confirm(`彻底删除${kindLabel}「${r.name}」？【不可恢复】，已挂靠客户的「${kindLabel}」将被清空。如只想隐藏请用「归档」。`))
              del.mutate(r.id)
          }}
        >
          彻底删除
        </button>
    </li>
  )
}

/** 介绍人 / 归属人管理（referrers 一表两用，开关切换；kind 缺失的旧数据按介绍人处理）。 */
export function ReferrerListPage() {
  const referrers = useReferrers()
  // ?kind=owner 深链直达归属人视图（新建归属人保存后返回也好落回原 tab）
  const [searchParams] = useSearchParams()
  const [kind, setKind] = useState<ReferrerKind>(
    searchParams.get('kind') === 'owner' ? 'owner' : 'referrer',
  )
  const kindLabel = REFERRER_KIND_LABELS[kind]
  const rows = (referrers.data ?? []).filter((r) => (r.kind ?? 'referrer') === kind)
  const newTo = kind === 'owner' ? '/referrers/new?kind=owner' : '/referrers/new'

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">介绍人 / 归属人</h1>
          <p className="mt-0.5 text-sm text-muted">
            {kind === 'referrer' ? '介绍客户来的人，财务「付介绍人」对账用' : '客户归属的人/渠道，建档时可直接选择或创建'}
          </p>
        </div>
        <Link to={newTo}>
          <Button>
            <PlusIcon className="size-[18px]" /> 新建{kindLabel}
          </Button>
        </Link>
      </div>

      {/* 介绍人 / 归属人 开关（与档案库 文件/回收站 同款段控） */}
      <div className="inline-flex gap-1 rounded-full bg-surface-2 p-1">
        {(['referrer', 'owner'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`min-h-9 rounded-full px-4 text-[13.5px] font-semibold transition-colors ${
              kind === k ? 'bg-white text-brand-700 shadow-xs' : 'text-muted hover:text-body'
            }`}
          >
            {REFERRER_KIND_LABELS[k]}
          </button>
        ))}
      </div>

      {referrers.isPending ? (
        <LoadingBlock />
      ) : referrers.isError ? (
        <ErrorBlock error={referrers.error} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={`还没有${kindLabel}`}
          icon="🤝"
          action={
            <Link to={newTo}>
              <Button>新建第一个{kindLabel}</Button>
            </Link>
          }
        />
      ) : (
        <Card>
          <ul>
            {rows.map((r) => (
              <ReferrerRow key={r.id} r={r} kindLabel={kindLabel} />
            ))}
          </ul>
        </Card>
      )}
    </section>
  )
}
