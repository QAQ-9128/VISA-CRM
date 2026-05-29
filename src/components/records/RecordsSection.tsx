import { useMemo, useState } from 'react'
import {
  useCreateRecord,
  useDeleteRecord,
  useRecordsByCase,
  useRecordsByCustomer,
  useUpdateRecord,
} from '../../hooks/queries/useRecords'
import { useProfiles } from '../../hooks/queries/useProfiles'
import { useAuth } from '../../hooks/useAuth'
import { recordDate, sortRecords } from '../../lib/records'
import { formatDueCountdown, isTaskOverdue } from '../../lib/tasks'
import { FOLLOW_UP_EMOJIS, DEFAULT_FOLLOW_UP_EMOJI } from '../../types/domain'
import { TrashIcon } from '../ui/icons'
import type { RecordRow } from '../../types/models'

interface Scope {
  customerId: string
  caseId?: string
}
interface WhoOption {
  id: string
  name: string
}

const TD = 'px-2 py-2 align-middle'
const TASK_VALUE = '__task__'

function alertErr(e: unknown) {
  window.alert('操作失败：' + (e instanceof Error ? e.message : String(e)))
}

/** 标记下拉：待办 + 全部 emoji，任意行都能在两者间切换（切换 = UPDATE 同一行的 type）。 */
function MarkerSelect({ value, disabled, onPick }: { value: string; disabled?: boolean; onPick: (v: string) => void }) {
  return (
    <select
      aria-label="标记"
      value={value}
      disabled={disabled}
      onChange={(e) => onPick(e.target.value)}
      className="rounded-md border border-slate-200 bg-white px-1 py-1 text-base leading-none outline-none focus:border-indigo-400 disabled:opacity-50"
    >
      <option value={TASK_VALUE}>待办</option>
      {FOLLOW_UP_EMOJIS.map((e) => (
        <option key={e} value={e}>
          {e}
        </option>
      ))}
    </select>
  )
}

function InlineText({
  value,
  placeholder,
  displayClassName = 'text-slate-900',
  onSave,
}: {
  value: string
  placeholder: string
  displayClassName?: string
  onSave: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value)

  if (editing) {
    return (
      <textarea
        autoFocus
        rows={1}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => {
          setEditing(false)
          const v = val.trim()
          if (v !== '' && v !== value) onSave(v)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            ;(e.target as HTMLTextAreaElement).blur()
          } else if (e.key === 'Escape') {
            setVal(value)
            setEditing(false)
          }
        }}
        className="w-full resize-none rounded border border-indigo-300 px-2 py-1 text-base outline-none focus:ring-2 focus:ring-indigo-200"
      />
    )
  }
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => {
        setVal(value)
        setEditing(true)
      }}
      className={`min-h-[1.75rem] cursor-text whitespace-pre-wrap break-words text-base ${displayClassName}`}
    >
      {value ? value : <span className="text-slate-300">{placeholder}</span>}
    </div>
  )
}

function InlineDate({
  value,
  display,
  danger,
  placeholder = '选择日期',
  onSave,
}: {
  value: string
  display: string
  danger?: boolean
  placeholder?: string
  onSave: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)
  if (editing) {
    return (
      <input
        type="date"
        autoFocus
        defaultValue={value}
        onChange={(e) => {
          setEditing(false)
          if (e.target.value !== value) onSave(e.target.value)
        }}
        onBlur={() => setEditing(false)}
        className="w-[9rem] rounded border border-indigo-300 px-1.5 py-1 text-sm outline-none"
      />
    )
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`whitespace-nowrap text-sm tabular-nums ${danger ? 'font-medium text-rose-600' : 'text-slate-600'}`}
    >
      {display ? display : <span className="text-slate-300">{placeholder}</span>}
      {danger ? ' 逾期' : ''}
    </button>
  )
}

function WhoSelect({ value, options, onChange }: { value: string | null; options: WhoOption[]; onChange: (id: string) => void }) {
  return (
    <select
      aria-label="By who"
      value={value ?? ''}
      onChange={(e) => e.target.value && onChange(e.target.value)}
      className="max-w-[7.5rem] rounded-md border border-transparent bg-transparent px-1 py-1 text-sm text-slate-600 outline-none hover:border-slate-200 focus:border-indigo-400"
    >
      {!value && <option value="">—</option>}
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  )
}

function RowActions({ onDelete }: { onDelete: () => void }) {
  return (
    <button
      type="button"
      aria-label="删除"
      title="删除"
      onClick={onDelete}
      className="text-slate-300 opacity-100 transition hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100"
    >
      <TrashIcon className="size-4" />
    </button>
  )
}

// ── 单条记录行（待办/跟进同表；类型切换 = UPDATE 同一行 type，不再跨表）──────────
function RecordRowView({ rec, who, today }: { rec: RecordRow; who: WhoOption[]; today: Date }) {
  const update = useUpdateRecord()
  const del = useDeleteRecord()
  const isTask = rec.type === 'task'
  const overdue = isTask && isTaskOverdue(rec.due_date, rec.is_done)
  const dateStr = recordDate(rec).slice(0, 10)
  const busy = update.isPending

  const patch = (p: Parameters<typeof update.mutate>[0]['patch']) =>
    update.mutate({ id: rec.id, patch: p }, { onError: alertErr })

  return (
    <tr className="group border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
      <td className={`${TD} w-32`}>
        <div className="flex items-center gap-1.5">
          {isTask && (
            <input
              type="checkbox"
              checked={rec.is_done}
              disabled={busy}
              onChange={(e) => patch({ is_done: e.target.checked, done_at: e.target.checked ? new Date().toISOString() : null })}
              className="size-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
          )}
          <MarkerSelect
            value={isTask ? TASK_VALUE : rec.emoji_marker ?? DEFAULT_FOLLOW_UP_EMOJI}
            disabled={busy}
            onPick={(v) => {
              if (isTask) {
                if (v !== TASK_VALUE)
                  patch({ type: 'follow_up', emoji_marker: v, due_date: null, is_done: false, done_at: null, assigned_to: null })
              } else if (v === TASK_VALUE) {
                patch({ type: 'task', is_done: false, done_at: null, emoji_marker: null, channel: null })
              } else {
                patch({ emoji_marker: v })
              }
            }}
          />
        </div>
      </td>
      <td className={TD}>
        <InlineText
          value={rec.content}
          placeholder="点击输入内容…"
          displayClassName={isTask && rec.is_done ? 'text-slate-400 line-through' : 'text-slate-800'}
          onSave={(v) => patch({ content: v })}
        />
      </td>
      <td className={`${TD} w-28`}>
        {isTask ? (
          <div className="space-y-0.5">
            <span className="inline-flex items-center gap-1" title="截止日期">
              <span aria-hidden>📅</span>
              <InlineDate
                value={rec.due_date ?? ''}
                display={rec.due_date ?? ''}
                danger={overdue}
                placeholder="设截止日"
                onSave={(v) => patch({ due_date: v || null })}
              />
            </span>
            {!rec.is_done && rec.due_date && (
              <div className={`text-xs ${overdue ? 'font-medium text-rose-600' : 'text-emerald-600'}`}>
                {formatDueCountdown(rec.due_date, today)}
              </div>
            )}
          </div>
        ) : (
          <InlineDate value={rec.created_at.slice(0, 10)} display={dateStr} onSave={(v) => v && patch({ created_at: v })} />
        )}
      </td>
      <td className={`${TD} w-28`}>
        <WhoSelect value={rec.created_by} options={who} onChange={(id) => patch({ created_by: id })} />
      </td>
      <td className={`${TD} w-8 text-right`}>
        <RowActions onDelete={() => del.mutate(rec.id, { onError: alertErr })} />
      </td>
    </tr>
  )
}

// ── 底部常驻空行：选标记 → 输内容 → 失焦/Enter 创建，再生成新空行 ────────────────
function DraftRow({ scope, currentWho }: { scope: Scope; currentWho: string }) {
  const create = useCreateRecord()
  const [type, setType] = useState<'task' | 'follow' | null>(null)
  const [emoji, setEmoji] = useState<string>(DEFAULT_FOLLOW_UP_EMOJI)
  const [due, setDue] = useState('')

  function reset() {
    setType(null)
    setEmoji(DEFAULT_FOLLOW_UP_EMOJI)
    setDue('')
  }
  function commit(content: string) {
    const c = content.trim()
    if (!c || create.isPending) return
    const opts = { onSuccess: reset, onError: alertErr }
    if (type === 'follow') {
      create.mutate({ customer_id: scope.customerId, case_id: scope.caseId ?? null, type: 'follow_up', content: c, emoji_marker: emoji }, opts)
    } else {
      create.mutate({ customer_id: scope.customerId, case_id: scope.caseId ?? null, type: 'task', content: c, due_date: due || null }, opts)
    }
  }

  const markerValue = type === 'follow' ? emoji : type === 'task' ? TASK_VALUE : ''

  return (
    <tr className="border-b border-dashed border-slate-200 bg-slate-50/40">
      <td className={`${TD} w-32`}>
        <select
          aria-label="选择标记"
          value={markerValue}
          onChange={(e) => {
            const v = e.target.value
            if (v === '') setType(null)
            else if (v === TASK_VALUE) setType('task')
            else {
              setType('follow')
              setEmoji(v)
            }
          }}
          className="rounded-md border border-slate-200 bg-white px-1 py-1 text-base outline-none focus:border-indigo-400"
        >
          <option value="">＋标记</option>
          <option value={TASK_VALUE}>☐ 待办</option>
          {FOLLOW_UP_EMOJIS.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </td>
      <td className={TD}>
        <InlineText value="" placeholder="点击添加内容…" onSave={commit} />
      </td>
      <td className={`${TD} w-28`}>
        {type === 'follow' ? (
          <span className="text-sm text-slate-300">创建日（自动）</span>
        ) : (
          <span className="inline-flex items-center gap-1" title="截止日期">
            <span aria-hidden>📅</span>
            <InlineDate value={due} display={due} placeholder="设截止日" onSave={setDue} />
          </span>
        )}
      </td>
      <td className={`${TD} w-28 truncate text-sm text-slate-400`} title={currentWho}>
        {currentWho}
      </td>
      <td className={`${TD} w-8`} />
    </tr>
  )
}

/** 待办 + 跟进合并的「记录」表（单表 records，Excel 式 inline 编辑）。 */
export function RecordsSection({ customerId, caseId }: Scope) {
  const scope: Scope = { customerId, caseId }
  const { user } = useAuth()
  const byCase = useRecordsByCase(caseId)
  const byCustomer = useRecordsByCustomer(caseId ? undefined : customerId)
  const query = caseId ? byCase : byCustomer
  const profiles = useProfiles()

  const whoOptions = useMemo<WhoOption[]>(
    () => (profiles.data ?? []).map((p) => ({ id: p.id, name: p.full_name ?? '—' })),
    [profiles.data],
  )
  const currentWho = useMemo(() => {
    const me = (profiles.data ?? []).find((p) => p.id === user?.id)
    return me?.full_name ?? '我'
  }, [profiles.data, user?.id])

  const records = useMemo(() => sortRecords(query.data ?? []), [query.data])
  const today = useMemo(() => new Date(), [])
  const todayStr = useMemo(() => {
    const d = today
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [today])

  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-slate-900">
        记录 <span className="text-xs font-normal text-slate-400">· 今天 {todayStr}</span>
      </h2>

      {query.isPending ? (
        <p className="text-sm text-slate-400">加载记录…</p>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <table className="w-full min-w-[36rem] border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-left text-sm font-medium text-slate-500">
                <th className="px-2 py-2">标记</th>
                <th className="px-2 py-2">内容</th>
                <th className="px-2 py-2">更新日期</th>
                <th className="px-2 py-2">By who</th>
                <th className="w-8 px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <RecordRowView key={r.id} rec={r} who={whoOptions} today={today} />
              ))}
              <DraftRow scope={scope} currentWho={currentWho} />
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
