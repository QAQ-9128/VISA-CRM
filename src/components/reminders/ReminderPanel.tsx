import { useMemo, useRef, useState } from 'react'
import type { FormEvent, PointerEvent as ReactPointerEvent } from 'react'
import { Button } from '../ui/Button'
import { SearchIcon } from '../ui/icons'
import { useCreateReminder } from '../../hooks/queries/useReminders'
import { customerDisplayName } from '../../lib/customerName'
import { caseVisaLabel } from '../../lib/caseBoard'
import { OFFSET_UNITS, REPEAT_RULES, firstDueDate, formatDueCn, type OffsetUnit, type RepeatRule } from '../../lib/reminders'
import type { Case, Customer } from '../../types/models'

interface CaseOption {
  caseId: string
  name: string
  caseNumber: string
  visaLabel: string
  searchText: string
}

const winW = () => (typeof window !== 'undefined' ? window.innerWidth : 1024)
const winH = () => (typeof window !== 'undefined' ? window.innerHeight : 768)

/** ② 提醒规则区输入框统一样式：浅底 #f8fbf9 / 细边 #e6ece8 / 圆角 12px（清新绿 focus）。 */
const FIELD_CLS =
  'h-11 rounded-[12px] border border-[#e6ece8] px-3.5 text-[15px] text-ink outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand-100'

/**
 * 新建提醒浮窗（唯一入口 = 日历日期格「+」）：同页 dialog、不跳转。
 *  - 桌面：**可拖动**（标题栏为把手，cursor:move，限制在视口内）；窄屏：max-lg 退化为底部 sheet。
 *  - ①关联案件（搜客户名/案件号，必选）②自定义规则（内容 + 数字+天/月/年「后提醒」+ 重复）。
 *  - 基准日 = 被点的那天(baseDate)，offset 默认 0 = 就在那天。保存写 case_id 外键 + base_date。
 */
export function ReminderPanel({
  cases,
  customerById,
  baseDate,
  onClose,
}: {
  cases: Case[]
  customerById: Record<string, Customer>
  /** 被点的日期格（YYYY-MM-DD，本地）= 基准日，预填 */
  baseDate: string
  onClose: () => void
}) {
  const create = useCreateReminder()
  const dialogRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState(() => ({ x: Math.max(12, winW() / 2 - 300), y: 72 }))
  const drag = useRef<{ ox: number; oy: number; bx: number; by: number } | null>(null)

  const [query, setQuery] = useState('')
  const [caseId, setCaseId] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [base, setBase] = useState(baseDate) // 基准日：预填被点那天，可改
  const [value, setValue] = useState('0') // 默认 0 = 就在基准日当天
  const [unit, setUnit] = useState<OffsetUnit>('day')
  const [repeat, setRepeat] = useState<RepeatRule>('never')

  // 实际提醒日预览（基准日 + offset，本地日期；随 基准日/数字/单位 实时更新）
  const offsetN = Math.max(0, Math.floor(Number(value) || 0))
  const dueDate = firstDueDate(base, offsetN, unit)

  // ── 拖动：标题栏 pointerdown 起拖，window 监听 move/up，限制不被拖出视口 ──
  function onHandleDown(e: ReactPointerEvent) {
    drag.current = { ox: e.clientX, oy: e.clientY, bx: pos.x, by: pos.y }
    const move = (ev: PointerEvent) => {
      const d = drag.current
      if (!d) return
      const w = dialogRef.current?.offsetWidth ?? 0
      const h = dialogRef.current?.offsetHeight ?? 0
      const x = Math.max(0, Math.min(d.bx + (ev.clientX - d.ox), winW() - w))
      const y = Math.max(0, Math.min(d.by + (ev.clientY - d.oy), winH() - h))
      setPos({ x, y })
    }
    const up = () => {
      drag.current = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const options = useMemo<CaseOption[]>(
    () =>
      cases.map((c) => {
        const cust = customerById[c.customer_id]
        const name = customerDisplayName(cust) || '（未知客户）'
        return {
          caseId: c.id,
          name,
          caseNumber: c.case_number,
          visaLabel: caseVisaLabel(c.visa_subclass, c.visa_stream),
          searchText: [name, cust?.english_name ?? '', c.case_number].join(' ').toLowerCase(),
        }
      }),
    [cases, customerById],
  )
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (q ? options.filter((o) => o.searchText.includes(q)) : options).slice(0, 8)
  }, [options, query])
  const selected = caseId ? options.find((o) => o.caseId === caseId) ?? null : null
  const canSave = !!caseId && content.trim() !== '' && !create.isPending

  function save(e: FormEvent) {
    e.preventDefault()
    if (!caseId || content.trim() === '') return
    create.mutate(
      {
        case_id: caseId,
        content: content.trim(),
        base_date: base,
        offset_value: offsetN,
        offset_unit: unit,
        repeat_rule: repeat,
      },
      { onSuccess: onClose },
    )
  }

  return (
    <>
      {/* 窄屏半透明背板（桌面不挡，拖开仍可见底下日历） */}
      <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-label="新建提醒"
        style={{ left: pos.x, top: pos.y }}
        className="fixed z-50 max-h-[88vh] w-[600px] max-w-[calc(100vw-24px)] overflow-y-auto rounded-[18px] bg-white [box-shadow:0_30px_80px_-30px_rgba(0,0,0,.4)] max-lg:!inset-x-0 max-lg:!bottom-0 max-lg:!left-0 max-lg:!top-auto max-lg:!w-full max-lg:!max-w-none max-lg:!rounded-b-none"
      >
        <form onSubmit={save}>
          {/* 标题栏 = 拖动把手 */}
          <div
            onPointerDown={onHandleDown}
            className="flex cursor-move touch-none select-none items-center gap-2 border-b border-line px-5 py-3.5 max-lg:cursor-default"
          >
            <span aria-hidden className="text-faint">⠿</span>
            <h2 className="font-serif text-[18px] font-bold text-ink">新建提醒</h2>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-muted max-lg:hidden">↔ 可拖动</span>
            <button
              type="button"
              aria-label="关闭"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onClose}
              className="ml-auto grid size-7 place-items-center rounded-full text-muted hover:bg-surface-2"
            >
              ✕
            </button>
          </div>

          <div className="p-5">
            {/* ① 关联案件 */}
            <div className="mb-2 flex items-center gap-2 text-[15px] font-bold text-ink">
              <span className="grid size-6 place-items-center rounded-full bg-emerald-600 text-[12px] font-bold text-white">1</span>
              关联案件 <span className="text-[13px] font-semibold text-rose-500">*必选</span>
            </div>
            {selected ? (
              <div className="flex items-center gap-3 rounded-[14px] border border-emerald-200 bg-emerald-50/60 px-4 py-3">
                <span className="text-emerald-700">✓</span>
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">
                  {selected.name} <span className="ml-1 text-[13px] font-normal text-faint tabular-nums">{selected.caseNumber}</span>
                </span>
                <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[12.5px] font-bold text-emerald-700">{selected.visaLabel}</span>
                <button type="button" onClick={() => setCaseId(null)} className="shrink-0 text-[13px] font-semibold text-brand-700 hover:underline">更换</button>
              </div>
            ) : (
              <div className="rounded-[14px] border border-line-2 bg-white">
                <div className="flex h-11 items-center gap-2.5 border-b border-line px-3.5 text-faint">
                  <SearchIcon className="size-[18px] shrink-0" />
                  <input
                    type="search"
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="搜客户名 / 案件号"
                    aria-label="搜索案件"
                    className="h-full w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-faint"
                  />
                </div>
                <ul className="max-h-[200px] overflow-y-auto p-1.5">
                  {results.length === 0 ? (
                    <li className="px-2 py-4 text-center text-[13px] text-faint">无匹配案件</li>
                  ) : (
                    results.map((o) => (
                      <li key={o.caseId}>
                        <button
                          type="button"
                          onClick={() => setCaseId(o.caseId)}
                          className="flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left transition-colors hover:bg-surface-2"
                        >
                          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">
                            {o.name} <span className="text-[12px] font-normal text-faint tabular-nums">{o.caseNumber}</span>
                          </span>
                          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11.5px] font-semibold text-emerald-700">{o.visaLabel}</span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}

            {/* ② 提醒规则 */}
            <div className="mb-3 mt-6 flex items-center gap-2 text-[15px] font-bold text-ink">
              <span className="grid size-6 place-items-center rounded-full bg-emerald-600 text-[12px] font-bold text-white">2</span>
              提醒规则
            </div>

            {/* 内容 */}
            <label htmlFor="rem-content" className="mb-1.5 block text-[13px] font-semibold text-muted">内容</label>
            <textarea
              id="rem-content"
              rows={2}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="自己写… 例：更新同居材料 / 2 年后办 186 TRT"
              className="w-full resize-none rounded-[12px] border border-[#e6ece8] bg-[#f8fbf9] px-3.5 py-2.5 text-[15px] text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand-100"
            />

            {/* 提醒时间：圆角小卡，一行 [基准日 📅] 起 [数字] [天/月/年▾] 后 + 绿色实时预览 */}
            <label className="mt-4 mb-1.5 block text-[13px] font-semibold text-muted">提醒时间</label>
            <div className="rounded-[14px] border border-[#e6ece8] bg-[#f8fbf9] p-3">
              <div className="flex flex-wrap items-center gap-2 text-[14px] text-muted">
                <input
                  type="date"
                  aria-label="基准日"
                  value={base}
                  onChange={(e) => setBase(e.target.value || baseDate)}
                  className={FIELD_CLS + ' w-[170px] bg-white font-semibold text-ink'}
                />
                <span>起</span>
                <input
                  type="number"
                  aria-label="偏移数字"
                  min={0}
                  step={1}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className={FIELD_CLS + ' w-[72px] bg-white text-center font-semibold text-ink'}
                />
                <select
                  aria-label="偏移单位"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as OffsetUnit)}
                  className={FIELD_CLS + ' w-[78px] bg-white font-semibold text-ink'}
                >
                  {OFFSET_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
                <span>后</span>
              </div>
              {/* 实时预览（green-bg / green-deep） */}
              <div className="mt-2.5 rounded-[10px] bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">
                <span aria-hidden className="mr-1">🔔</span>将于 <b className="font-bold text-emerald-900">{formatDueCn(dueDate)}</b> 提醒
                {offsetN === 0 && <span className="text-emerald-700"> · 0 = 就在基准日当天</span>}
              </div>
            </div>

            {/* 重复 */}
            <label htmlFor="rem-repeat" className="mt-4 mb-1.5 block text-[13px] font-semibold text-muted">重复</label>
            <select
              id="rem-repeat"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value as RepeatRule)}
              className={FIELD_CLS + ' w-full bg-[#f8fbf9]'}
            >
              {REPEAT_RULES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            {create.isError && <p className="mt-3 text-sm text-[var(--color-coral)]">保存失败，请重试。</p>}

            <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4">
              <Button type="button" variant="ghost" onClick={onClose}>取消</Button>
              <Button type="submit" disabled={!canSave}>{create.isPending ? '保存中…' : '保存提醒'}</Button>
            </div>
          </div>
        </form>
      </div>
    </>
  )
}
