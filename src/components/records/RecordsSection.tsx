import { useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  useCreateRecord,
  useDeleteRecord,
  useRecordsByCase,
  useRecordsByCustomer,
  useUpdateRecord,
} from '../../hooks/queries/useRecords'
import { useProfiles } from '../../hooks/queries/useProfiles'
import {
  recordDate,
  sortRecords,
  sortRecordsAsc,
  filterRecordsByType,
  recordStats,
  selectPendingTasks,
} from '../../lib/records'
import type { RecordTypeFilter } from '../../lib/records'
import { formatDueCountdown, isTaskOverdue } from '../../lib/tasks'
import { todayYmd, isFutureYmd, isPastYmd } from '../../lib/dateRules'
import { toastError } from '../../store/ui'
import { FOLLOW_UP_EMOJIS, DEFAULT_FOLLOW_UP_EMOJI } from '../../types/domain'
import { Card, CardHead } from '../ui/Card'
import { Button } from '../ui/Button'
import { DocIcon, TrendUpIcon, ClockIcon, TrashIcon } from '../ui/icons'
import type { RecordRow } from '../../types/models'

interface Scope {
  customerId: string
  caseId?: string
}
interface WhoOption {
  id: string
  name: string
}

// 待办在标记下拉里的取值（emoji 之外的特殊项）。emoji 集合一律沿用 FOLLOW_UP_EMOJIS，不改动。
const TASK_VALUE = '__task__'

// 操作失败的反馈由 queryClient 全局 MutationCache 统一弹红 toast，不再各处 window.alert。

/** 标记下拉：待办 + 全部 emoji（与原实现完全一致，emoji 不变）。切换 = UPDATE 同一行 type。 */
function MarkerSelect({ value, disabled, onPick }: { value: string; disabled?: boolean; onPick: (v: string) => void }) {
  return (
    <select
      aria-label="标记"
      value={value}
      disabled={disabled}
      onChange={(e) => onPick(e.target.value)}
      className="rounded-md border border-line-2 bg-white px-1.5 py-1 text-base leading-none outline-none focus:border-brand disabled:opacity-50"
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
  displayClassName = 'text-ink',
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
        className="w-full resize-none rounded border border-brand/50 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-brand-100"
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
      className={`cursor-text whitespace-pre-wrap break-words text-sm ${displayClassName}`}
    >
      {value ? value : <span className="text-faint">{placeholder}</span>}
    </div>
  )
}

function InlineDate({
  value,
  display,
  danger,
  placeholder = '选择日期',
  min,
  max,
  rangeError,
  onSave,
}: {
  value: string
  display: string
  danger?: boolean
  placeholder?: string
  /** 最早可选日期（待办截止日传今天 → 禁过去） */
  min?: string
  /** 最晚可选日期（跟进记录日传今天 → 禁未来） */
  max?: string
  /** 超出 min/max 时的提示文案 */
  rangeError?: string
  onSave: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)
  if (editing) {
    return (
      <input
        type="date"
        autoFocus
        min={min}
        max={max}
        defaultValue={value}
        onChange={(e) => {
          const v = e.target.value
          if (v === value) return
          // min/max 属性挡选择器，这里兜底拦手输
          if (v && ((min && v < min) || (max && v > max))) {
            toastError(rangeError ?? '日期超出可选范围')
            return
          }
          onSave(v)
        }}
        onBlur={() => setEditing(false)}
        className="w-[9rem] rounded border border-brand/50 px-1.5 py-1 text-sm outline-none"
      />
    )
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`whitespace-nowrap text-xs tabular-nums ${danger ? 'font-medium text-rose-600' : 'text-faint'}`}
    >
      {display ? display : <span className="text-faint">{placeholder}</span>}
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
      className="max-w-[7.5rem] rounded-md border border-transparent bg-transparent px-1 py-0.5 text-xs text-muted outline-none hover:border-line-2 focus:border-brand"
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

// ── 时间线单条（待办/跟进同表；保留全部 inline 编辑 + emoji 标记逻辑）──────────
function TimelineEntry({
  rec,
  who,
  today,
  isLast,
}: {
  rec: RecordRow
  who: WhoOption[]
  today: Date
  isLast: boolean
}) {
  const update = useUpdateRecord()
  const del = useDeleteRecord()
  const isTask = rec.type === 'task'
  const overdue = isTask && isTaskOverdue(rec.due_date, rec.is_done)
  const busy = update.isPending

  const patch = (p: Parameters<typeof update.mutate>[0]['patch']) =>
    update.mutate({ id: rec.id, patch: p })

  return (
    <li className="group relative flex gap-3.5 pb-5 last:pb-0">
      {!isLast && <span className="absolute left-[7px] top-5 bottom-0 w-px bg-line-2" aria-hidden />}
      <span
        className={`relative z-10 mt-1 size-3.5 shrink-0 rounded-full border-2 border-white ${
          overdue ? 'bg-rose-500' : isTask && rec.is_done ? 'bg-emerald-500' : 'bg-brand'
        }`}
        style={{ boxShadow: '0 0 0 2px var(--color-brand-100)' }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {isTask && (
            <input
              type="checkbox"
              checked={rec.is_done}
              disabled={busy}
              onChange={(e) => patch({ is_done: e.target.checked, done_at: e.target.checked ? new Date().toISOString() : null })}
              className="size-4 rounded border-line-2 text-brand focus:ring-brand"
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
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">
            {isTask ? '待办' : '跟进'}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <WhoSelect value={rec.created_by} options={who} onChange={(id) => patch({ created_by: id })} />
            <button
              type="button"
              aria-label="删除"
              title="删除"
              onClick={() => del.mutate(rec.id)}
              className="text-faint opacity-100 transition hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100"
            >
              <TrashIcon className="size-4" />
            </button>
          </div>
        </div>

        <div className="mt-1">
          <InlineText
            value={rec.content}
            placeholder="点击输入内容…"
            displayClassName={isTask && rec.is_done ? 'text-faint line-through' : 'text-body'}
            onSave={(v) => patch({ content: v })}
          />
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          {isTask ? (
            <span className="inline-flex items-center gap-1" title="截止日期">
              <span aria-hidden>📅</span>
              <InlineDate
                value={rec.due_date ?? ''}
                display={rec.due_date ?? ''}
                danger={overdue}
                placeholder="设截止日"
                min={todayYmd()}
                rangeError="截止日不能是过去的日期"
                onSave={(v) => patch({ due_date: v || null })}
              />
              {!rec.is_done && rec.due_date && (
                <span className={`text-xs ${overdue ? 'font-medium text-rose-600' : 'text-emerald-600'}`}>
                  {formatDueCountdown(rec.due_date, today)}
                </span>
              )}
            </span>
          ) : (
            <InlineDate
              value={rec.created_at.slice(0, 10)}
              display={recordDate(rec).slice(0, 10)}
              max={todayYmd()}
              rangeError="记录日期不能是未来"
              onSave={(v) => v && patch({ created_at: v })}
            />
          )}
        </div>
      </div>
    </li>
  )
}

// ── 左上：快速添加记录（标记下拉沿用待办 + emoji，emoji 不变）──────────────────
function QuickAddCard({ scope }: { scope: Scope }) {
  const create = useCreateRecord()
  const [marker, setMarker] = useState<string>(DEFAULT_FOLLOW_UP_EMOJI)
  const [content, setContent] = useState('')
  const [date, setDate] = useState('')
  const isTask = marker === TASK_VALUE

  function reset() {
    setContent('')
    setDate('')
  }
  function submit(e: FormEvent) {
    e.preventDefault()
    const c = content.trim()
    if (!c || create.isPending) return
    // 待办截止禁过去 / 跟进记录日禁未来（min/max 属性挡选择器，这里兜底拦手输）
    if (isTask && isPastYmd(date)) {
      toastError('截止日期不能是过去的日期')
      return
    }
    if (!isTask && isFutureYmd(date)) {
      toastError('记录日期不能是未来')
      return
    }
    const opts = { onSuccess: reset }
    if (isTask) {
      create.mutate(
        { customer_id: scope.customerId, case_id: scope.caseId ?? null, type: 'task', content: c, due_date: date || null },
        opts,
      )
    } else {
      create.mutate(
        {
          customer_id: scope.customerId,
          case_id: scope.caseId ?? null,
          type: 'follow_up',
          content: c,
          emoji_marker: marker,
          ...(date ? { created_at: `${date}T00:00:00Z` } : {}),
        },
        opts,
      )
    }
  }

  return (
    <Card>
      <CardHead title="快速添加记录" />
      <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-[11rem_1fr]">
        <label className="space-y-1.5">
          <span className="block text-[13px] font-semibold text-body">标记</span>
          <select
            value={marker}
            onChange={(e) => setMarker(e.target.value)}
            className="h-11 w-full rounded-[12px] border border-line-2 bg-white px-3 text-[15px] outline-none focus:border-brand"
          >
            <option value={TASK_VALUE}>待办</option>
            {FOLLOW_UP_EMOJIS.map((e) => (
              <option key={e} value={e}>
                {e} 跟进
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="block text-[13px] font-semibold text-body">内容</span>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={2}
            placeholder="请输入记录内容…"
            className="w-full resize-none rounded-[12px] border border-line-2 bg-white px-3 py-2 text-sm outline-none focus:border-brand"
          />
        </label>
        <label className="space-y-1.5">
          <span className="block text-[13px] font-semibold text-body">
            {isTask ? '截止日期（不能选过去）' : '记录日期（不能选未来）'}
          </span>
          <input
            type="date"
            min={isTask ? todayYmd() : undefined}
            max={isTask ? undefined : todayYmd()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-11 w-full rounded-[12px] border border-line-2 bg-white px-3 text-[15px] text-ink outline-none focus:border-brand"
          />
        </label>
        <div className="flex items-end justify-end">
          <Button type="submit" disabled={create.isPending || content.trim() === ''}>
            {create.isPending ? '保存中…' : '保存记录'}
          </Button>
        </div>
      </form>
    </Card>
  )
}

// ── 右上：记录统计 ───────────────────────────────────────────
function StatRow({ icon, tone, label, value }: { icon: ReactNode; tone: string; label: string; value: number }) {
  return (
    <li className="flex items-center gap-3">
      <span className={`grid size-9 shrink-0 place-items-center rounded-[11px] ${tone}`}>{icon}</span>
      <span className="text-sm text-body">{label}</span>
      <span className="ml-auto text-[20px] font-bold tabular-nums text-ink">{value}</span>
    </li>
  )
}

/**
 * 记录区：客户详情（按客户）或案件详情（按案件）复用。
 * variant='full'（默认）：两栏 = 左 快速添加+时间线 / 右 统计卡+待跟进。
 * variant='compact'：单列（窄栏用），统计收成一行小字，无大统计卡——功能不变。
 */
export function RecordsSection({ customerId, caseId, variant = 'full' }: Scope & { variant?: 'full' | 'compact' }) {
  const scope: Scope = { customerId, caseId }
  const byCase = useRecordsByCase(caseId)
  const byCustomer = useRecordsByCustomer(caseId ? undefined : customerId)
  const query = caseId ? byCase : byCustomer
  const profiles = useProfiles()

  const whoOptions = useMemo<WhoOption[]>(
    () => (profiles.data ?? []).map((p) => ({ id: p.id, name: p.full_name ?? '—' })),
    [profiles.data],
  )

  const all = useMemo(() => query.data ?? [], [query.data])
  const today = useMemo(() => new Date(), [])
  const stats = useMemo(() => recordStats(all, today), [all, today])
  const pending = useMemo(() => selectPendingTasks(all), [all])

  const [filter, setFilter] = useState<RecordTypeFilter>('all')
  const [newestFirst, setNewestFirst] = useState(true)
  const [visible, setVisible] = useState(8)

  const filtered = useMemo(() => {
    const byType = filterRecordsByType(all, filter)
    return newestFirst ? sortRecords(byType) : sortRecordsAsc(byType)
  }, [all, filter, newestFirst])
  const shown = filtered.slice(0, visible)

  const FILTERS: { value: RecordTypeFilter; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'follow_up', label: '跟进' },
    { value: 'task', label: '待办' },
  ]

  const timeline = (
    <Card pad={false}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-[22px] pt-[22px]">
        <h3 className="text-base font-bold tracking-[-0.01em] text-ink">记录时间线</h3>
        <select
          value={newestFirst ? 'desc' : 'asc'}
          onChange={(e) => setNewestFirst(e.target.value === 'desc')}
          className="h-9 rounded-full border border-line-2 bg-white px-3 text-sm text-ink outline-none focus:border-brand"
        >
          <option value="desc">最新在前</option>
          <option value="asc">最早在前</option>
        </select>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 px-[22px]">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => {
              setFilter(f.value)
              setVisible(8)
            }}
            className={`rounded-full px-3 py-1 text-[13px] font-medium transition-colors ${
              filter === f.value ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:bg-line-2'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="px-[22px] py-4">
        {query.isPending ? (
          <p className="text-sm text-faint">加载记录…</p>
        ) : shown.length === 0 ? (
          <p className="py-6 text-center text-sm text-faint">暂无记录，可在上方「快速添加记录」。</p>
        ) : (
          <ol>
            {shown.map((r, i) => (
              <TimelineEntry key={r.id} rec={r} who={whoOptions} today={today} isLast={i === shown.length - 1} />
            ))}
          </ol>
        )}
        {filtered.length > visible && (
          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={() => setVisible((v) => v + 8)}
              className="text-sm font-semibold text-brand hover:text-brand-600"
            >
              加载更多 ⌄
            </button>
          </div>
        )}
      </div>
    </Card>
  )

  const pendingCard = (
    <Card>
      <CardHead title="待跟进事项" />
      {pending.length === 0 ? (
        <p className="text-sm text-faint">暂无未完成待办。</p>
      ) : (
        <ul className="space-y-2.5">
          {pending.slice(0, 4).map((t) => {
            const overdue = isTaskOverdue(t.due_date, t.is_done)
            return (
              <li key={t.id} className="rounded-[14px] bg-surface-2 px-3.5 py-2.5">
                <p className="text-sm font-semibold text-ink">{t.content}</p>
                {t.due_date && (
                  <p className={`mt-1 flex items-center gap-1 text-xs tabular-nums ${overdue ? 'font-medium text-rose-600' : 'text-faint'}`}>
                    <span aria-hidden>📅</span>
                    {t.due_date}
                    {overdue ? ' · 逾期' : ''}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {pending.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setFilter('task')
            setVisible(Math.max(visible, pending.length))
          }}
          className="mt-3 text-[13px] font-semibold text-brand hover:text-brand-600"
        >
          查看全部待跟进 ({pending.length}) ›
        </button>
      )}
    </Card>
  )

  // compact：单列，统计收成一行小字（KPI 横条才是统计唯一来源）
  if (variant === 'compact') {
    return (
      <div className="space-y-5">
        <QuickAddCard scope={scope} />
        <div className="flex flex-wrap gap-x-5 gap-y-1 px-1 text-[13px] text-muted">
          <span>总记录 <b className="tabular-nums text-ink">{stats.total}</b></span>
          <span>本周 <b className="tabular-nums text-ink">{stats.thisWeek}</b></span>
          <span>待跟进 <b className="tabular-nums text-ink">{stats.pending}</b></span>
        </div>
        {timeline}
        {pendingCard}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      {/* 左主区 */}
      <div className="space-y-5 lg:col-span-2">
        <QuickAddCard scope={scope} />
        {timeline}
      </div>

      {/* 右侧栏 */}
      <div className="space-y-5">
        <Card>
          <CardHead title="记录统计" />
          <ul className="space-y-4">
            <StatRow icon={<DocIcon className="size-[18px]" />} tone="bg-brand-50 text-brand" label="总记录" value={stats.total} />
            <StatRow icon={<TrendUpIcon className="size-[18px]" />} tone="bg-emerald-50 text-emerald-600" label="本周新增" value={stats.thisWeek} />
            <StatRow icon={<ClockIcon className="size-[18px]" />} tone="bg-amber-50 text-amber-600" label="待跟进" value={stats.pending} />
          </ul>
        </Card>
        {pendingCard}
      </div>
    </div>
  )
}
