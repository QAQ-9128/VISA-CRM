import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  useAddChecklistItem,
  useDeleteChecklistItem,
  useToggleChecklistItem,
} from '../../hooks/queries/useChecklist'
import { useChecklistView } from '../../hooks/queries/useChecklistView'
import { useBackSource } from '../../hooks/useBackSource'
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
      <span className="inline-flex shrink-0 items-center rounded-[6px] bg-mute-bg px-2 py-[2px] text-[10.5px] font-medium text-faint">
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
      className="inline-flex shrink-0 items-center gap-1 rounded-[6px] bg-brand-50 px-2 py-[2px] text-[10.5px] font-medium text-brand hover:bg-brand-100"
    >
      🔗 {src.label}
    </Link>
  )
}

/**
 * 概览待办清单（mockup「精简案件优先」版）：卡头计数 + 输入框/添加 + notice 插槽（临近到期浅绿条）+ 逐条待办。
 * 新增默认为随手记；存量关联项照常显示关联 chip。关联对象归档后自动隐藏（取消归档又出现）。
 */
export function ChecklistCard({ notice }: { notice?: ReactNode }) {
  const { items, openCount, isPending, caseById, customerById } = useChecklistView()
  const add = useAddChecklistItem()
  const toggle = useToggleChecklistItem()
  const del = useDeleteChecklistItem()
  const [text, setText] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    add.mutate({ content: t, customerId: null, caseId: null }, { onSuccess: () => setText('') })
  }

  return (
    <section className="rounded-card bg-white pb-2 shadow-soft">
      <div className="flex items-center justify-between px-[22px] pt-[18px] pb-1">
        <h2 className="text-base font-semibold text-ink">
          待办清单
          {openCount > 0 && (
            <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-[7px] bg-emerald-50 px-1.5 align-[2px] text-[11.5px] font-semibold tabular-nums text-emerald-700">
              {openCount}
            </span>
          )}
        </h2>
      </div>

      <form onSubmit={submit} className="flex gap-2 px-[22px] pt-2 pb-2.5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="写一句待办，回车添加…"
          className="min-h-11 min-w-0 flex-1 rounded-[11px] border border-line bg-white px-3.5 text-[13px] text-ink outline-none placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand-100"
        />
        <button
          type="submit"
          disabled={add.isPending || text.trim() === ''}
          className="min-h-11 shrink-0 rounded-[11px] bg-emerald-50 px-[18px] text-[13.5px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
        >
          {add.isPending ? '添加中…' : '添加'}
        </button>
      </form>

      {notice}

      {isPending ? (
        <p className="px-[22px] py-2.5 text-sm text-faint">加载中…</p>
      ) : items.length === 0 ? (
        <p className="px-[22px] py-2.5 text-sm text-faint">还没有清单项，写一句加进去</p>
      ) : (
        <ul>
          {items.map((it) => (
            <li
              key={it.id}
              className="flex items-center gap-[11px] border-t border-surface-2 px-[22px] py-2.5 text-[13.5px] first:border-t-0"
            >
              <input
                type="checkbox"
                checked={it.is_done}
                onChange={() => toggle.mutate({ id: it.id, is_done: !it.is_done })}
                className="size-4 shrink-0 rounded-[5px] border-faint text-brand focus:ring-brand"
              />
              <span className={`min-w-0 flex-1 truncate ${it.is_done ? 'text-faint line-through' : 'text-ink'}`}>
                {it.content}
              </span>
              <LinkChip item={it} caseById={caseById} customerById={customerById} />
              <button
                type="button"
                onClick={() => del.mutate(it.id)}
                disabled={del.isPending}
                aria-label="删除"
                className="shrink-0 px-1 text-sm text-faint hover:text-rose-600"
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
