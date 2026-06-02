import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../ui/Button'
import {
  useAddChecklistItem,
  useDeleteChecklistItem,
  useToggleChecklistItem,
} from '../../hooks/queries/useChecklist'
import { useChecklistView } from '../../hooks/queries/useChecklistView'
import { useBackSource } from '../../hooks/useBackSource'
import { displayCustomerName } from '../../lib/dashboardView'
import { formatVisaType } from '../../lib/visa'
import { checklistSource } from '../../lib/checklist'
import type { ChecklistItem } from '../../types/models'
import type { Case, Customer } from '../../types/models'

/**
 * 来源标签：每条待办显示来自哪个客户/案件（点进对应详情）；不关联的标「随手记」。
 * 来源由真实关联字段派生（checklistSource）；关联对象已归档/不在册的不显示标签（不造假）。
 */
function LinkChip({
  item,
  caseById,
  customerById,
}: {
  item: ChecklistItem
  caseById: Record<string, Case>
  customerById: Record<string, Customer>
}) {
  const source = useBackSource()
  const src = checklistSource(item, caseById, customerById)
  if (src.kind === 'loose') {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-faint">
        随手记
      </span>
    )
  }
  if (src.kind === 'unresolved') return null
  return (
    <Link
      to={src.to}
      state={source}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand hover:bg-brand-100"
    >
      🔗 {src.label}
    </Link>
  )
}

/** 概览待办清单：一句话 + 勾选框，可选关联客户/案件；关联对象归档后自动隐藏（取消归档又出现）。 */
export function ChecklistCard() {
  const { items, openCount, isPending, cases, customers, caseById, customerById } = useChecklistView()
  const add = useAddChecklistItem()
  const toggle = useToggleChecklistItem()
  const del = useDeleteChecklistItem()
  const [text, setText] = useState('')
  const [link, setLink] = useState('') // '' | case:<id> | customer:<id>

  // 关联下拉：案件（客户·签证）+ 客户，按名排序
  const caseOptions = useMemo(
    () =>
      cases
        .map((c) => ({
          id: c.id,
          label: `${displayCustomerName(customerById[c.customer_id]?.full_name, c.visa_subclass)} · ${formatVisaType(c.visa_subclass, c.visa_stream)}`,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [cases, customerById],
  )
  const customerOptions = useMemo(
    () =>
      customers
        .map((c) => ({ id: c.id, label: displayCustomerName(c.full_name) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [customers],
  )

  function submit(e: FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    let customerId: string | null = null
    let caseId: string | null = null
    if (link.startsWith('case:')) {
      caseId = link.slice(5)
      customerId = caseById[caseId]?.customer_id ?? null
    } else if (link.startsWith('customer:')) {
      customerId = link.slice(9)
    }
    add.mutate(
      { content: t, customerId, caseId },
      { onSuccess: () => { setText(''); setLink('') } },
    )
  }

  return (
    <section className="rounded-card bg-white p-[22px] shadow-soft">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-base font-bold text-ink">待办清单</h2>
        {openCount > 0 && (
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold tabular-nums text-brand">{openCount}</span>
        )}
      </div>

      <form onSubmit={submit} className="mb-2 space-y-2">
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="写一句待办，回车添加…"
            className="min-h-11 flex-1 rounded-full border border-line-2 bg-surface-2 px-4 text-base outline-none focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/20"
          />
          <Button type="submit" disabled={add.isPending || text.trim() === ''}>
            {add.isPending ? '添加中…' : '添加'}
          </Button>
        </div>
        <select
          value={link}
          onChange={(e) => setLink(e.target.value)}
          className="h-9 w-full appearance-none rounded-full border border-line-2 bg-white px-4 text-[13px] text-body outline-none focus:border-brand focus:ring-2 focus:ring-brand-100"
        >
          <option value="">不关联（纯随手记）</option>
          {caseOptions.length > 0 && (
            <optgroup label="关联案件">
              {caseOptions.map((o) => (
                <option key={o.id} value={`case:${o.id}`}>{o.label}</option>
              ))}
            </optgroup>
          )}
          {customerOptions.length > 0 && (
            <optgroup label="关联客户">
              {customerOptions.map((o) => (
                <option key={o.id} value={`customer:${o.id}`}>{o.label}</option>
              ))}
            </optgroup>
          )}
        </select>
      </form>

      {isPending ? (
        <p className="py-2 text-sm text-faint">加载中…</p>
      ) : items.length === 0 ? (
        <p className="py-2 text-sm text-faint">还没有清单项，写一句加进去</p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-3 py-2.5">
              <input
                type="checkbox"
                checked={it.is_done}
                onChange={() => toggle.mutate({ id: it.id, is_done: !it.is_done })}
                className="size-4 shrink-0 rounded border-slate-300 text-brand focus:ring-brand"
              />
              <span className={`min-w-0 flex-1 truncate text-sm ${it.is_done ? 'text-faint line-through' : 'text-ink'}`}>
                {it.content}
              </span>
              <LinkChip item={it} caseById={caseById} customerById={customerById} />
              <button
                type="button"
                onClick={() => del.mutate(it.id)}
                disabled={del.isPending}
                aria-label="删除"
                className="shrink-0 px-1 text-sm text-slate-300 hover:text-rose-600"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
