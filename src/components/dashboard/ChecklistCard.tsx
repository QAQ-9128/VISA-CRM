import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../ui/Button'
import {
  useAddChecklistItem,
  useChecklist,
  useDeleteChecklistItem,
  useToggleChecklistItem,
} from '../../hooks/queries/useChecklist'

/** 概览的独立待办清单：一句话 + 一个勾选框，跟客户/案件都不关联（像 Excel 随手记）。 */
export function ChecklistCard() {
  const list = useChecklist()
  const add = useAddChecklistItem()
  const toggle = useToggleChecklistItem()
  const del = useDeleteChecklistItem()
  const [text, setText] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    add.mutate(t, { onSuccess: () => setText('') })
  }

  const items = list.data ?? []

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">待办清单</h2>

      <form onSubmit={submit} className="mb-2 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="写一句待办，回车添加…"
          className="min-h-11 flex-1 rounded-lg border border-slate-300 px-3 text-base outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
        />
        <Button type="submit" disabled={add.isPending || text.trim() === ''}>
          {add.isPending ? '添加中…' : '添加'}
        </Button>
      </form>

      {list.isPending ? (
        <p className="py-2 text-sm text-slate-400">加载中…</p>
      ) : items.length === 0 ? (
        <p className="py-2 text-sm text-slate-400">还没有清单项，写一句加进去</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-3 py-2.5">
              <input
                type="checkbox"
                checked={it.is_done}
                onChange={() => toggle.mutate({ id: it.id, is_done: !it.is_done })}
                className="size-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className={`min-w-0 flex-1 text-sm ${it.is_done ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                {it.content}
              </span>
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
