import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCases, useAllStageHistory } from '../../hooks/queries/useCases'
import { useCustomers } from '../../hooks/queries/useCustomers'
import { useAllCaseApplicants } from '../../hooks/queries/useCaseApplicants'
import { useOpenRecords } from '../../hooks/queries/useRecords'
import { useReminders } from '../../hooks/queries/useReminders'
import { useBackSource } from '../../hooks/useBackSource'
import { LoadingBlock, ErrorBlock } from '../../components/ui/states'
import { PlusIcon, SearchIcon } from '../../components/ui/icons'
import { Popover } from '../../components/ui/Popover'
import { MonthPicker } from '../../components/finance/MonthPicker'
import { ReminderPanel } from '../../components/reminders/ReminderPanel'
import { monthMatrix, weekDays, shiftDays, WEEKDAY_HEADERS, type CalendarDay } from '../../lib/calendarGrid'
import {
  selectCaseEvents, selectReminderEvents, selectAutoReminderEvents, eventsByDay, matchesEventSearch,
  CALENDAR_KIND_META, type CalendarEvent, type CalendarEventKind,
} from '../../lib/caseCalendar'
import { visibleCaseIds } from '../../lib/visibility'
import { currentMonth, shiftMonth, isMonthInBounds } from '../../lib/month'
import { todayYmd } from '../../lib/dateRules'
import type { Customer } from '../../types/models'

type CalView = 'month' | 'week' | 'day'

const WEEK_CN = ['日', '一', '二', '三', '四', '五', '六']
function dayTitle(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return `${m}月${d}日 · 周${WEEK_CN[new Date(y, m - 1, d).getDay()]}`
}

const LEGEND_ORDER: CalendarEventKind[] = ['lodged', 'approved', 'refused', 'docs', 'reminder']
/** 事件彩条静态色（左 3px 色条 + 浅底）——日历自有色板，静态类保证 Tailwind 裁剪保留。 */
const BAR_CLS: Record<CalendarEventKind, string> = {
  lodged: 'border-l-[#7e887e] bg-[#7e887e]/10',
  approved: 'border-l-[#357a52] bg-[#357a52]/10',
  refused: 'border-l-[#c0392b] bg-[#c0392b]/10',
  docs: 'border-l-[#c08a2e] bg-[#c08a2e]/10',
  reminder: 'border-l-[#7c6fd6] bg-[#7c6fd6]/10',
}

function Dot({ color }: { color: string }) {
  return <span aria-hidden className="size-[7px] shrink-0 rounded-full" style={{ backgroundColor: color }} />
}

/** 「+」加提醒按钮（月格右上 hover 显现 / 周·日列头常显）。 */
function AddBtn({ date, onAdd, hover }: { date: string; onAdd: (d: string) => void; hover?: boolean }) {
  return (
    <button
      type="button"
      aria-label={`给 ${date} 加提醒`}
      onClick={(e) => { e.stopPropagation(); onAdd(date) }}
      className={`grid size-[20px] shrink-0 place-items-center rounded-full text-faint transition-opacity hover:bg-brand-50 hover:text-brand-700 focus-visible:opacity-100 ${
        hover ? 'opacity-60 lg:opacity-0 lg:group-hover:opacity-100' : 'opacity-70'
      }`}
    >
      <PlusIcon className="size-[15px]" />
    </button>
  )
}

/** 事件详情 popover 内容：客户 + 类型 + 案件号 + 去案件。 */
function EventDetail({ ev, onGo }: { ev: CalendarEvent; onGo: () => void }) {
  const meta = CALENDAR_KIND_META[ev.kind]
  return (
    <div className="w-[232px] space-y-2 text-left">
      <div className="flex items-center gap-2">
        <Dot color={meta.color} />
        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">{ev.customerName}</span>
        <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: meta.color + '22', color: meta.color }}>{ev.typeLabel}</span>
      </div>
      {ev.detail && <p className="text-[12.5px] leading-snug text-body">{ev.detail}</p>}
      <p className="text-[11.5px] text-faint">{ev.visaLabel} · 案件号 {ev.caseNumber}</p>
      <button type="button" onClick={onGo} className="text-[12.5px] font-semibold text-brand-700 hover:underline">去案件 →</button>
    </div>
  )
}

/** 一条事件彩条：点开详情 popover（不跳整页）。 */
function EventBar({ ev, go }: { ev: CalendarEvent; go: (e: CalendarEvent) => void }) {
  return (
    <Popover
      ariaLabel={`${ev.customerName} ${ev.typeLabel}`}
      panelClassName="w-[252px]"
      triggerClassName={`block w-full truncate rounded-[4px] border-l-[3px] py-[3px] pl-2 pr-1 text-left text-[11.5px] leading-tight transition-[filter] hover:brightness-95 ${BAR_CLS[ev.kind]}`}
      triggerContent={<><span className="text-ink">{ev.customerName}</span> <span className="text-faint">{ev.typeLabel}</span></>}
    >
      {(close) => <EventDetail ev={ev} onGo={() => { go(ev); close() }} />}
    </Popover>
  )
}

/** 「+N 个更多」→ 当天全部事件 popover，每条带去案件。 */
function DayMore({ date, overflow, events, go }: { date: string; overflow: number; events: CalendarEvent[]; go: (e: CalendarEvent) => void }) {
  return (
    <Popover
      ariaLabel={`+${overflow} 个更多`}
      panelClassName="w-[268px]"
      triggerClassName="block w-full rounded-[4px] px-2 py-[2px] text-left text-[11px] font-semibold text-brand-700 hover:bg-surface-2"
      triggerContent={`+${overflow} 个更多`}
    >
      {(close) => (
        <div className="text-left">
          <div className="mb-2 text-[13px] font-bold text-ink">{dayTitle(date)} · 共 {events.length} 件</div>
          <ul className="max-h-[260px] space-y-1 overflow-y-auto">
            {events.map((ev) => (
              <li key={ev.id} className="flex items-center gap-2 rounded-[8px] px-2 py-1.5 hover:bg-surface-2">
                <Dot color={CALENDAR_KIND_META[ev.kind].color} />
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{ev.customerName} <span className="text-faint">{ev.typeLabel}</span></span>
                <button type="button" onClick={() => { go(ev); close() }} className="shrink-0 text-[11.5px] font-semibold text-brand-700 hover:underline">去案件 →</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Popover>
  )
}

/** 今天=绿色实心圆日号；非本月淡显。 */
function DayNum({ cell, today }: { cell: CalendarDay; today: string }) {
  const isToday = cell.date === today
  return (
    <span className={`grid size-[22px] place-items-center rounded-full text-[12px] font-semibold tabular-nums ${
      isToday ? 'bg-emerald-600 text-white' : cell.inMonth ? 'text-ink' : 'text-faint/45'
    }`}>{cell.day}</span>
  )
}

/** 月视图单格：日号 + 「+」+ 至多 2 条彩条 + 「+N 个更多」。 */
function MonthCell({ cell, events, today, onAdd, go }: { cell: CalendarDay; events: CalendarEvent[]; today: string; onAdd: (d: string) => void; go: (e: CalendarEvent) => void }) {
  const shown = events.slice(0, 2)
  const overflow = events.length - shown.length
  return (
    <div className={`group relative min-h-[112px] border-r border-b border-line p-1.5 [&:nth-child(7n)]:border-r-0 ${cell.inMonth ? '' : 'bg-surface-2/30'}`}>
      <div className="mb-1 flex items-center justify-between">
        <DayNum cell={cell} today={today} />
        <AddBtn date={cell.date} onAdd={onAdd} hover />
      </div>
      <div className="space-y-[3px]">
        {shown.map((ev) => <EventBar key={ev.id} ev={ev} go={go} />)}
        {overflow > 0 && <DayMore date={cell.date} overflow={overflow} events={events} go={go} />}
      </div>
    </div>
  )
}

/** 周 / 日视图的单日列：列头(周几 + 日号 + 「+」) + 当天全部彩条（不折叠）。 */
function DayColumn({ cell, weekday, events, today, onAdd, go, minH }: { cell: CalendarDay; weekday?: string; events: CalendarEvent[]; today: string; onAdd: (d: string) => void; go: (e: CalendarEvent) => void; minH: string }) {
  return (
    <div className="flex flex-col">
      <div className="group flex items-center justify-between border-b border-line bg-[#f6faf7] px-2.5 py-2">
        <span className="flex items-center gap-1.5 text-[12px] font-bold text-muted">
          {weekday && <span>周{weekday}</span>}
          <DayNum cell={cell} today={today} />
        </span>
        <AddBtn date={cell.date} onAdd={onAdd} />
      </div>
      <div className={`space-y-1 p-1.5 ${minH}`}>
        {events.length === 0
          ? <p className="px-1 py-3 text-center text-[11.5px] text-faint">无事件</p>
          : events.map((ev) => <EventBar key={ev.id} ev={ev} go={go} />)}
      </div>
    </div>
  )
}

export function CalendarPage() {
  const navigate = useNavigate()
  const source = useBackSource()
  const cases = useCases()
  const customers = useCustomers({})
  const applicants = useAllCaseApplicants()
  const stageHistory = useAllStageHistory()
  const tasks = useOpenRecords()
  const reminders = useReminders()

  const today = todayYmd()
  const [view, setView] = useState<CalView>('month')
  const [anchor, setAnchor] = useState(today) // 焦点日（月视图取其月份；周/日视图取其周/日）
  const [search, setSearch] = useState('')
  const [reminderDate, setReminderDate] = useState<string | null>(null)
  const month = anchor.slice(0, 7)

  const ty = Number(currentMonth().slice(0, 4))
  const bounds = useMemo(() => ({ min: `${ty - 3}-01`, max: `${ty + 3}-12` }), [ty])

  const customerById = useMemo<Record<string, Customer>>(
    () => Object.fromEntries((customers.data ?? []).map((c) => [c.id, c])),
    [customers.data],
  )
  const visibleCases = useMemo(() => {
    const visible = visibleCaseIds(cases.data ?? [], customerById, applicants.data ?? [])
    return (cases.data ?? []).filter((c) => visible.has(c.id))
  }, [cases.data, customerById, applicants.data])

  // 视图内可见的天 + 涉及的月份（提醒按月推算到期日，要覆盖跨月边缘）
  const monthWeeks = useMemo(() => monthMatrix(month), [month])
  const viewDays = useMemo<CalendarDay[]>(() => {
    if (view === 'month') return monthWeeks.flat()
    if (view === 'week') return weekDays(anchor)
    return [{ date: anchor, day: Number(anchor.slice(8, 10)), inMonth: true }]
  }, [view, monthWeeks, anchor])
  const visibleMonths = useMemo(() => [...new Set(viewDays.map((d) => d.date.slice(0, 7)))], [viewDays])

  const events = useMemo(() => {
    const base = selectCaseEvents(visibleCases, customerById, stageHistory.data ?? [], tasks.data ?? [])
    const rem = visibleMonths.flatMap((m) => [
      ...selectReminderEvents(reminders.data ?? [], visibleCases, customerById, m),
      ...selectAutoReminderEvents(visibleCases, customerById, stageHistory.data ?? [], m),
    ])
    return [...base, ...rem].filter((e) => matchesEventSearch(e, search))
  }, [visibleCases, customerById, stageHistory.data, tasks.data, reminders.data, visibleMonths, search])
  const byDay = useMemo(() => eventsByDay(events), [events])

  // 导航：按视图前后翻；今天回到本月/本周/本日
  const prevAnchor = view === 'month' ? `${shiftMonth(month, -1)}-01` : shiftDays(anchor, view === 'week' ? -7 : -1)
  const nextAnchor = view === 'month' ? `${shiftMonth(month, 1)}-01` : shiftDays(anchor, view === 'week' ? 7 : 1)
  const canPrev = isMonthInBounds(prevAnchor.slice(0, 7), bounds)
  const canNext = isMonthInBounds(nextAnchor.slice(0, 7), bounds)

  const go = (e: CalendarEvent) => navigate(`/customers/${e.customerId}?case=${e.caseId}`, { state: source })
  const onAdd = (d: string) => setReminderDate(d)

  if (cases.isPending || customers.isPending || stageHistory.isPending || tasks.isPending) return <LoadingBlock />
  if (cases.isError || customers.isError) return <ErrorBlock error={new Error('日历数据加载失败，请刷新重试')} />

  return (
    <section className="space-y-3">
      {/* 顶栏：标题 + 今天 + ‹ › + 月份直选 + 搜索 + 月/周/日 */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-[24px] font-bold tracking-[-0.01em] text-ink">案件日历</h1>
        <button
          type="button"
          onClick={() => setAnchor(today)}
          className="h-9 rounded-full border border-line-2 bg-white px-3.5 text-[13px] font-semibold text-body shadow-xs hover:border-brand-100"
        >
          今天
        </button>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="上一页" disabled={!canPrev} onClick={() => canPrev && setAnchor(prevAnchor)} className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40">‹</button>
          <button type="button" aria-label="下一页" disabled={!canNext} onClick={() => canNext && setAnchor(nextAnchor)} className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40">›</button>
        </div>
        <MonthPicker month={month} todayMonth={currentMonth()} bounds={bounds} onSelect={(m) => setAnchor(`${m}-01`)} />

        <div className="ml-auto flex items-center gap-3">
          <div className="flex h-9 w-[220px] items-center gap-2 rounded-full border border-line-2 bg-white px-3.5 text-faint shadow-xs focus-within:border-brand focus-within:ring-2 focus-within:ring-brand-100">
            <SearchIcon className="size-[16px] shrink-0" />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜客户 / 案件号 / 类型…" aria-label="搜索事件" className="h-full w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-faint" />
          </div>
          <div className="inline-flex gap-1 rounded-full bg-surface-2 p-1">
            {(['month', 'week', 'day'] as const).map((v) => (
              <button key={v} type="button" onClick={() => setView(v)} className={`h-7 rounded-full px-3 text-[13px] font-semibold transition-colors ${view === v ? 'bg-white text-brand shadow-xs' : 'text-muted hover:text-body'}`}>
                {v === 'month' ? '月' : v === 'week' ? '周' : '日'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 图例 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-muted">
        {LEGEND_ORDER.map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5"><Dot color={CALENDAR_KIND_META[k].color} />{CALENDAR_KIND_META[k].legend}</span>
        ))}
      </div>

      {/* 视图主体 */}
      {view === 'month' && (
        <div className="overflow-hidden rounded-card border border-line bg-white shadow-soft">
          <div className="grid grid-cols-7 border-b border-line bg-[#f6faf7] text-center text-[11.5px] font-bold text-muted">
            {WEEKDAY_HEADERS.map((w) => <div key={w} className="py-2.5">周{w}</div>)}
          </div>
          {monthWeeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7">
              {week.map((cell) => (
                <MonthCell key={cell.date} cell={cell} events={byDay.get(cell.date) ?? []} today={today} onAdd={onAdd} go={go} />
              ))}
            </div>
          ))}
        </div>
      )}

      {view === 'week' && (
        <div className="overflow-hidden rounded-card border border-line bg-white shadow-soft">
          <div className="grid grid-cols-7 divide-x divide-line">
            {weekDays(anchor).map((cell, i) => (
              <DayColumn key={cell.date} cell={cell} weekday={WEEKDAY_HEADERS[i]} events={byDay.get(cell.date) ?? []} today={today} onAdd={onAdd} go={go} minH="min-h-[420px]" />
            ))}
          </div>
        </div>
      )}

      {view === 'day' && (
        <div className="overflow-hidden rounded-card border border-line bg-white shadow-soft sm:max-w-[520px]">
          <DayColumn cell={viewDays[0]} events={byDay.get(anchor) ?? []} today={today} onAdd={onAdd} go={go} minH="min-h-[440px]" />
        </div>
      )}

      {/* 新建提醒浮窗（唯一入口 = 日期格/列头「+」；基准日 = 被点那天） */}
      {reminderDate && (
        <ReminderPanel cases={visibleCases} customerById={customerById} baseDate={reminderDate} onClose={() => setReminderDate(null)} />
      )}
    </section>
  )
}
