import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  useRecycleBin,
  useUnarchiveCase,
  useUnarchiveCustomer,
  useUnarchiveDocument,
  useUnarchiveEmployer,
  useUnarchiveReferrer,
} from '../../hooks/queries/useRecycleBin'
import { useDeleteCase } from '../../hooks/queries/useCases'
import { useDeleteCustomer } from '../../hooks/queries/useCustomers'
import { useDeleteDocument } from '../../hooks/queries/useDocuments'
import { useDeleteEmployer } from '../../hooks/queries/useEmployers'
import { useDeleteReferrer } from '../../hooks/queries/useReferrers'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { LoadingBlock, ErrorBlock } from '../../components/ui/states'
import { formatVisaType } from '../../lib/visa'
import { displayCustomerName } from '../../lib/dashboardView'

/** 待删目标：kind 决定确认文案与调用的 mutation。 */
interface DeleteTarget {
  kind: 'customer' | 'case' | 'document' | 'employer' | 'referrer'
  id: string
  /** 弹窗标题里的名称 */
  name: string
  /** 文件行需要：删行后清理 Storage 实体 */
  storagePath?: string | null
}

/** 一条回收站行：名称 + 说明 + 恢复 + 彻底删除。 */
function Row({
  name,
  meta,
  pending,
  onRestore,
  onDelete,
  deletePending,
}: {
  name: string
  meta?: string
  pending: boolean
  onRestore: () => void
  onDelete?: () => void
  deletePending: boolean
}) {
  return (
    <li className="flex items-center justify-between gap-3 border-t border-surface-2 px-[22px] py-3 first:border-t-0">
      <span className="flex min-w-0 items-center gap-[11px]">
        <Avatar name={name} size={34} radius={10} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-ink">{name}</span>
          {meta && <span className="mt-px block truncate text-xs text-faint">{meta}</span>}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <Button variant="secondary" disabled={pending} onClick={onRestore}>
          {pending ? '恢复中…' : '恢复'}
        </Button>
        {onDelete && (
          <Button variant="ghost" disabled={deletePending} onClick={onDelete} className="text-rose-600 hover:bg-rose-50">
            {deletePending ? '删除中…' : '彻底删除'}
          </Button>
        )}
      </span>
    </li>
  )
}

/** 分组卡：有内容才渲染。 */
function Group({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  if (count === 0) return null
  return (
    <section className="rounded-card bg-white pb-1 shadow-soft">
      <h2 className="px-[22px] pt-[18px] pb-1 text-base font-semibold text-ink">
        {title}
        <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-[7px] bg-emerald-50 px-1.5 align-[2px] text-[11.5px] font-semibold tabular-nums text-emerald-700">
          {count}
        </span>
      </h2>
      <ul>{children}</ul>
    </section>
  )
}

/** 各类型删除确认文案（与实际级联行为逐字对应，不夸大不隐瞒）。 */
const DELETE_COPY: Record<DeleteTarget['kind'], ReactNode> = {
  customer: (
    <>
      TA 的<b>客户资料、文件、跟进/待办</b>将永久删除，<b>不可恢复</b>。
      案件处理：<b>多人案件保留</b>（移出 TA、过户给其余参与人，账目不动）；
      <b>仅 TA 一人的案件</b>连同递交记录与账目<b>整案删除</b>。
    </>
  ),
  case: (
    <>
      将连同其<b>递交记录、阶段历史、全部账目</b>一并永久删除，<b>不可恢复</b>；
      所有参与人的档案里都不再有此案件。
    </>
  ),
  document: (
    <>
      文件记录与存储中的<b>文件实体</b>将一并永久删除，<b>不可恢复</b>。
    </>
  ),
  employer: (
    <>
      雇主资料将永久删除，<b>不可恢复</b>；已挂靠客户/案件的「担保雇主」字段将被清空（客户本身不受影响）。
    </>
  ),
  referrer: (
    <>
      介绍人资料将永久删除，<b>不可恢复</b>；已挂靠客户的「介绍人」字段将被清空（客户与账目本身不受影响）。
    </>
  ),
}

/**
 * 回收站：列出全部已归档的 客户 / 案件 / 文件 / 雇主 / 介绍人——
 * 每条可「恢复」（is_archived 置回，原数据与关联原样回来）或「彻底删除」（终点，不可恢复）。
 */
export function RecycleBin() {
  const bin = useRecycleBin()
  const restoreCustomer = useUnarchiveCustomer()
  const restoreCase = useUnarchiveCase()
  const restoreDocument = useUnarchiveDocument()
  const restoreEmployer = useUnarchiveEmployer()
  const restoreReferrer = useUnarchiveReferrer()
  const deleteCustomer = useDeleteCustomer()
  const deleteCase = useDeleteCase()
  const deleteDocument = useDeleteDocument()
  const deleteEmployer = useDeleteEmployer()
  const deleteReferrer = useDeleteReferrer()

  const [target, setTarget] = useState<DeleteTarget | null>(null)

  if (bin.isPending) return <LoadingBlock />
  if (bin.isError) return <ErrorBlock error={new Error('回收站数据加载失败，请刷新重试')} />

  const total =
    bin.archivedCustomers.length +
    bin.archivedCases.length +
    bin.archivedDocuments.length +
    bin.archivedEmployers.length +
    bin.archivedReferrers.length

  if (total === 0) {
    return (
      <p className="rounded-card bg-white py-10 text-center text-sm text-faint shadow-soft">
        回收站是空的——归档的客户 / 案件 / 文件 / 雇主 / 介绍人会出现在这里，可一键恢复或彻底删除
      </p>
    )
  }

  const deletePending =
    deleteCustomer.isPending || deleteCase.isPending || deleteDocument.isPending ||
    deleteEmployer.isPending || deleteReferrer.isPending

  function confirmDelete() {
    if (!target) return
    const t = target
    setTarget(null)
    if (t.kind === 'customer') deleteCustomer.mutate(t.id)
    else if (t.kind === 'case') deleteCase.mutate(t.id)
    else if (t.kind === 'document') deleteDocument.mutate({ id: t.id, storagePath: t.storagePath ?? null })
    else if (t.kind === 'employer') deleteEmployer.mutate(t.id)
    else deleteReferrer.mutate(t.id)
  }

  return (
    <div className="space-y-4">
      <Group title="已归档客户" count={bin.archivedCustomers.length}>
        {bin.archivedCustomers.map((c) => {
          const name = displayCustomerName(c.full_name)
          return (
            <Row
              key={c.id}
              name={name}
              meta="恢复后回到客户列表；随 TA 归档的案件在下方分别恢复"
              pending={restoreCustomer.isPending && restoreCustomer.variables === c.id}
              onRestore={() => restoreCustomer.mutate(c.id)}
              onDelete={() => setTarget({ kind: 'customer', id: c.id, name })}
              deletePending={deleteCustomer.isPending && deleteCustomer.variables === c.id}
            />
          )
        })}
      </Group>

      <Group title="已归档案件" count={bin.archivedCases.length}>
        {bin.archivedCases.map((k) => {
          const name = `${k.case_number} · ${formatVisaType(k.visa_subclass, k.visa_stream)}`
          return (
            <Row
              key={k.id}
              name={name}
              meta={`客户：${displayCustomerName(bin.customerById[k.customer_id]?.full_name)}`}
              pending={restoreCase.isPending && restoreCase.variables === k.id}
              onRestore={() => restoreCase.mutate(k.id)}
              onDelete={() => setTarget({ kind: 'case', id: k.id, name })}
              deletePending={deleteCase.isPending && deleteCase.variables === k.id}
            />
          )
        })}
      </Group>

      <Group title="已归档文件" count={bin.archivedDocuments.length}>
        {bin.archivedDocuments.map((d) => {
          const name = d.file_name || d.title || '（未命名）'
          return (
            <Row
              key={d.id}
              name={name}
              meta={`客户：${displayCustomerName(bin.customerById[d.customer_id]?.full_name)}`}
              pending={restoreDocument.isPending && restoreDocument.variables === d.id}
              onRestore={() => restoreDocument.mutate(d.id)}
              onDelete={() => setTarget({ kind: 'document', id: d.id, name, storagePath: d.storage_path })}
              deletePending={deleteDocument.isPending && deleteDocument.variables?.id === d.id}
            />
          )
        })}
      </Group>

      <Group title="已归档雇主" count={bin.archivedEmployers.length}>
        {bin.archivedEmployers.map((e) => (
          <Row
            key={e.id}
            name={e.name}
            pending={restoreEmployer.isPending && restoreEmployer.variables === e.id}
            onRestore={() => restoreEmployer.mutate(e.id)}
            onDelete={() => setTarget({ kind: 'employer', id: e.id, name: e.name })}
            deletePending={deleteEmployer.isPending && deleteEmployer.variables === e.id}
          />
        ))}
      </Group>

      <Group title="已归档介绍人" count={bin.archivedReferrers.length}>
        {bin.archivedReferrers.map((r) => (
          <Row
            key={r.id}
            name={r.name}
            pending={restoreReferrer.isPending && restoreReferrer.variables === r.id}
            onRestore={() => restoreReferrer.mutate(r.id)}
            onDelete={() => setTarget({ kind: 'referrer', id: r.id, name: r.name })}
            deletePending={deleteReferrer.isPending && deleteReferrer.variables === r.id}
          />
        ))}
      </Group>

      {/* 统一的彻底删除确认（红色两键），文案按类型给 */}
      {target && (
        <ConfirmDialog
          open
          title={`彻底删除「${target.name}」？`}
          tone="danger"
          description={DELETE_COPY[target.kind]}
          confirmLabel="删除"
          pendingLabel="删除中…"
          pending={deletePending}
          onConfirm={confirmDelete}
          onClose={() => setTarget(null)}
        />
      )}
    </div>
  )
}
