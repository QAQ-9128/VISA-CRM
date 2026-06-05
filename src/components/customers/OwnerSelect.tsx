import { useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useCreateOwner, useReferrers } from '../../hooks/queries/useReferrers'

/** 同名判定归一：trim + 折叠内部空白 + 小写（仅用于过滤/查重，不改入库值）。 */
const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()

/**
 * 归属人选择器（Notion 式「选择或创建一个选项」）：
 * 输入即过滤已有归属人（referrers.kind='owner'）；输入新名字出现「创建 "…"」行，
 * 选中即建实体（kind='owner'）并关联；已选时提供「清空归属人」。
 * 与介绍人共用 referrers 表，但下拉互不混入（kind 区分）。
 */
export function OwnerSelect({
  value,
  onChange,
  label = '归属人',
}: {
  value: string | null
  onChange: (ownerId: string | null) => void
  label?: string
}) {
  const referrers = useReferrers()
  const createOwner = useCreateOwner()
  const inputId = useId()
  const listId = useId()
  const blurTimer = useRef<number | null>(null)

  // 迁移防御：kind 列尚未加（或旧缓存）时一律视为介绍人 → 归属人下拉为空但不误抓
  const owners = useMemo(
    () => (referrers.data ?? []).filter((r) => r.kind === 'owner'),
    [referrers.data],
  )
  const selectedName = useMemo(
    () => (value ? (referrers.data ?? []).find((r) => r.id === value)?.name ?? '' : ''),
    [referrers.data, value],
  )

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState<string | null>(null) // null = 未编辑 → 显示已选名字
  const [active, setActive] = useState(-1)

  const text = query ?? selectedName
  const q = norm(query ?? '')
  const filtered = q ? owners.filter((o) => norm(o.name).includes(q)) : owners
  const hasExact = owners.some((o) => norm(o.name) === q)
  const canCreate = q !== '' && !hasExact && !createOwner.isPending

  // 行模型：选项… + 创建行 + 清空行（统一索引，键盘高亮共用）
  type Row = { key: string; label: string; act: () => void; tone?: 'create' | 'clear' }
  const rows: Row[] = [
    ...filtered.map((o) => ({
      key: o.id,
      label: o.name,
      act: () => pick(o.id),
    })),
    ...(canCreate
      ? [{
          key: '__create',
          label: `创建 "${(query ?? '').trim()}"`,
          tone: 'create' as const,
          act: () => {
            createOwner.mutate(
              { name: (query ?? '').trim(), kind: 'owner' },
              { onSuccess: (r) => pick(r.id) },
            )
          },
        }]
      : []),
    ...(value
      ? [{ key: '__clear', label: '清空归属人', tone: 'clear' as const, act: () => pick(null) }]
      : []),
  ]

  function pick(id: string | null) {
    onChange(id)
    setQuery(null)
    setOpen(false)
    setActive(-1)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      const delta = e.key === 'ArrowDown' ? 1 : -1
      setActive((i) => Math.min(Math.max(i + delta, 0), rows.length - 1))
      return
    }
    if (e.key === 'Enter') {
      // 关键：拦下 Enter，避免冒泡提交外层 <form>（快速建档弹窗 / 客户大表单）
      e.preventDefault()
      const row = rows[active] ?? (canCreate ? rows[filtered.length] : rows[0])
      row?.act()
      return
    }
    if (e.key === 'Escape' && open) {
      e.stopPropagation() // 只关下拉，别连带关掉外层弹窗
      setQuery(null)
      setOpen(false)
      setActive(-1)
    }
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-[13.5px] font-semibold text-body">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder="选择或输入归属人…"
          value={text}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            setActive(-1)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // 延迟关闭：让下拉项的 mousedown/click 先落地
            blurTimer.current = window.setTimeout(() => setOpen(false), 120)
          }}
          onKeyDown={onKeyDown}
          className="block h-12 w-full rounded-[14px] border border-line-2 bg-white px-3.5 text-[15px] text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand-100"
        />
        {open && rows.length > 0 && (
          <ul
            id={listId}
            role="listbox"
            aria-label="归属人选项"
            // 防止点击选项前 input 先 blur 把下拉关掉
            onMouseDown={(e) => e.preventDefault()}
            className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-auto rounded-[14px] border border-line bg-white py-1 shadow-soft"
          >
            {rows.map((row, i) => (
              <li
                key={row.key}
                role="option"
                aria-selected={row.key === value}
                onClick={row.act}
                onMouseEnter={() => setActive(i)}
                className={`flex min-h-11 cursor-pointer items-center px-3.5 text-[14px] ${
                  i === active ? 'bg-surface-2' : ''
                } ${
                  row.tone === 'create'
                    ? 'font-semibold text-brand-600'
                    : row.tone === 'clear'
                      ? 'text-faint'
                      : 'text-ink'
                }`}
              >
                {row.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
