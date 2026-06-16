import { customerDisplayName } from './customerName'
import { localYmd } from './dateRules'
import { formatVisaType } from './visa'
import { getLodgementLodgedDate } from './lodgementStatus'
import { isCohabEligible } from './cohab'
import { addMonths, firstDueDate, occurrencesInMonth, type OffsetUnit, type RepeatRule } from './reminders'
import type { Case, CaseReminder, CaseStageHistory, Customer, RecordRow } from '../types/models'
import type { CaseStage } from '../types/domain'

/**
 * 「案件日历」纯派生层：把现有案件数据（case_stage_history 阶段日期 + 带截止日的待办）
 * 摊成**单点事件**（每事件只占其当天一个点，不画审理时长跨度）。纯读、不含金额。
 * 数据源沿用「递交进度」：阶段历史(递交/获批/拒签) + 待办(补件)；紫色提醒在二期并入。
 * 颜色为日历自有，不改 lib/statusColor。
 */

export type CalendarEventKind = 'lodged' | 'approved' | 'refused' | 'docs' | 'reminder'

/** 事件类型 → 颜色 + 图例文案（日历自有色板，照 mockup）。 */
export const CALENDAR_KIND_META: Record<CalendarEventKind, { color: string; legend: string }> = {
  lodged: { color: '#7e887e', legend: '提名 / 签证递交' },
  approved: { color: '#357a52', legend: '下签 / 获批' },
  refused: { color: '#c0392b', legend: '拒签' },
  docs: { color: '#c08a2e', legend: '补件 / 要求补件' },
  reminder: { color: '#7c6fd6', legend: '提醒（自定义 / TRT / 补材料）' },
}

export interface CalendarEvent {
  id: string
  /** 落点本地日历日 YYYY-MM-DD */
  date: string
  kind: CalendarEventKind
  /** 短标签：提名递交/签证递交/提名获批/下签/拒签/补件/提醒 */
  typeLabel: string
  /** 主体：案件主客户名（中文名优先） */
  customerName: string
  caseId: string
  /** 跳转用：案件主客户 id（→ 客户详情选中该案 / 进度） */
  customerId: string
  caseNumber: string
  visaLabel: string
  /** day detail 副行（待办内容 / 提醒内容 / null） */
  detail: string | null
}

/** 时间戳→本地日；纯日期串（YYYY-MM-DD，无 T）原样取（DateStr 无时区）。 */
export function localDayOf(value: string): string {
  return value.includes('T') ? localYmd(new Date(value)) : value.slice(0, 10)
}

/** to_stage → 日历事件类型（只取关键里程碑，其余阶段不出点）。 */
const STAGE_EVENT: Partial<Record<CaseStage, { kind: CalendarEventKind; label: string }>> = {
  nomination_lodged: { kind: 'lodged', label: '提名递交' },
  visa_lodged: { kind: 'lodged', label: '签证递交' },
  nomination_approved: { kind: 'approved', label: '提名获批' },
  granted: { kind: 'approved', label: '下签' },
  refused: { kind: 'refused', label: '拒签' },
}

/**
 * 案件自动事件（一期）：阶段历史里程碑 + 带截止日的开放待办（补件）。
 * 紫色提醒（二期）由 selectReminderEvents 另出后合并。
 */
export function selectCaseEvents(
  cases: Case[],
  customerById: Record<string, Customer>,
  stageHistory: CaseStageHistory[],
  tasks: RecordRow[],
): CalendarEvent[] {
  const caseById = new Map(cases.map((c) => [c.id, c]))
  const meta = (caseId: string) => {
    const c = caseById.get(caseId)
    if (!c) return null
    return {
      caseId,
      customerId: c.customer_id,
      caseNumber: c.case_number,
      customerName: customerDisplayName(customerById[c.customer_id]),
      visaLabel: formatVisaType(c.visa_subclass, c.visa_stream),
    }
  }

  const events: CalendarEvent[] = []

  // 阶段里程碑：递交(灰) / 获批·下签(绿) / 拒签(红)
  for (const h of stageHistory) {
    const ev = STAGE_EVENT[h.to_stage]
    if (!ev) continue
    const m = meta(h.case_id)
    if (!m) continue
    events.push({
      id: `stage-${h.id}`,
      date: localDayOf(h.effective_at ?? h.changed_at),
      kind: ev.kind,
      typeLabel: ev.label,
      ...m,
      detail: null,
    })
  }

  // 补件(黄)：带截止日的未完成待办（type=task），落在截止日
  for (const t of tasks) {
    if (t.type !== 'task' || t.is_done || !t.case_id || !t.due_date) continue
    const m = meta(t.case_id)
    if (!m) continue
    events.push({
      id: `task-${t.id}`,
      date: localDayOf(t.due_date),
      kind: 'docs',
      typeLabel: '补件',
      ...m,
      detail: t.content,
    })
  }

  return events
}

/**
 * 自定义提醒事件（二期，紫点）：每条提醒 = 案件 + 内容 + 首次到期(创建日+offset) + 重复规则；
 * 列出**某月内**全部到期日。停用(enabled=false)不出；案件不存在跳过。
 */
export function selectReminderEvents(
  reminders: Pick<CaseReminder, 'id' | 'case_id' | 'content' | 'base_date' | 'offset_value' | 'offset_unit' | 'repeat_rule' | 'enabled'>[],
  cases: Case[],
  customerById: Record<string, Customer>,
  monthYm: string,
): CalendarEvent[] {
  const caseById = new Map(cases.map((c) => [c.id, c]))
  const out: CalendarEvent[] = []
  for (const r of reminders) {
    if (!r.enabled) continue
    const c = caseById.get(r.case_id)
    if (!c) continue
    // 到期 = 基准日(点「+」的日期格) + offset；首期再按重复规则在该月列举
    const first = firstDueDate(r.base_date, r.offset_value, r.offset_unit as OffsetUnit)
    for (const date of occurrencesInMonth(first, r.repeat_rule as RepeatRule, monthYm)) {
      out.push({
        id: `rem-${r.id}-${date}`,
        date,
        kind: 'reminder',
        typeLabel: '提醒',
        customerName: customerDisplayName(customerById[c.customer_id]),
        caseId: c.id,
        customerId: c.customer_id,
        caseNumber: c.case_number,
        visaLabel: formatVisaType(c.visa_subclass, c.visa_stream),
        detail: r.content,
      })
    }
  }
  return out
}

/** 该案最近一次「下签」的本地日期；无 → null。 */
function latestGrantDay(history: CaseStageHistory[]): string | null {
  let best: string | null = null
  for (const h of history) {
    if (h.to_stage !== 'granted') continue
    const d = localDayOf(h.effective_at ?? h.changed_at)
    if (!best || d > best) best = d
  }
  return best
}
const isTrt186 = (c: Pick<Case, 'visa_subclass' | 'visa_stream'>) =>
  c.visa_subclass.includes('186') && /temporary residence transition|trt/i.test(c.visa_stream ?? '')

/**
 * 现有自动提醒（紫点，统一呈现，不改其触发逻辑）：
 *  - TRT：482 下签 + 满 2 年（grant + 24 个月）单点；enabled & 未关闭 & 有下签 & 该客户尚无 186 TRT 案。
 *  - 同居材料：186/配偶签每 3 个月循环（锚点 = 上次确认 ?? 最近递交 ?? 建档，首期 = 锚点 + 3 个月）。
 * 这些是**日历落点派生**，独立于 lib/trt、lib/cohab 的「现在该不该提醒」判定。
 */
export function selectAutoReminderEvents(
  cases: Case[],
  customerById: Record<string, Customer>,
  stageHistory: CaseStageHistory[],
  monthYm: string,
): CalendarEvent[] {
  const histByCase = new Map<string, CaseStageHistory[]>()
  for (const h of stageHistory) {
    const arr = histByCase.get(h.case_id) ?? []
    arr.push(h)
    histByCase.set(h.case_id, arr)
  }
  const casesByCustomer = new Map<string, Case[]>()
  for (const c of cases) {
    const arr = casesByCustomer.get(c.customer_id) ?? []
    arr.push(c)
    casesByCustomer.set(c.customer_id, arr)
  }
  const TERMINAL: ReadonlySet<CaseStage> = new Set<CaseStage>(['granted', 'refused', 'withdrawn'])
  const out: CalendarEvent[] = []
  const push = (c: Case, date: string, typeLabel: string, detail: string) =>
    out.push({
      id: `auto-${typeLabel}-${c.id}-${date}`,
      date,
      kind: 'reminder',
      typeLabel,
      customerName: customerDisplayName(customerById[c.customer_id]),
      caseId: c.id,
      customerId: c.customer_id,
      caseNumber: c.case_number,
      visaLabel: formatVisaType(c.visa_subclass, c.visa_stream),
      detail,
    })

  for (const c of cases) {
    const hist = histByCase.get(c.id) ?? []
    // TRT 2 年提醒（grant + 24 个月，单点）
    if (c.trt_reminder_enabled && !c.trt_reminder_dismissed) {
      const grant = latestGrantDay(hist)
      const has186Trt = (casesByCustomer.get(c.customer_id) ?? []).some(isTrt186)
      if (grant && !has186Trt) {
        for (const date of occurrencesInMonth(addMonths(grant, 24), 'never', monthYm)) {
          push(c, date, 'TRT 提醒', '下签满 2 年 · 可递 186 TRT')
        }
      }
    }
    // 更新同居材料（锚点 + 3 个月起，每 3 个月循环）
    if (c.cohab_reminder_enabled && isCohabEligible(c) && !TERMINAL.has(c.current_stage)) {
      const nom = getLodgementLodgedDate(hist, 'nomination')
      const visa = getLodgementLodgedDate(hist, 'visa')
      const lodged = nom && visa ? (nom >= visa ? nom : visa) : nom ?? visa
      const anchor = c.cohab_reminder_last ?? lodged ?? localDayOf(c.created_at)
      for (const date of occurrencesInMonth(addMonths(anchor, 3), 'every3months', monthYm)) {
        push(c, date, '补材料提醒', '更新同居材料')
      }
    }
  }
  return out
}

/** 事件搜索：按 客户名 / 案件号 / 事件类型 过滤（空 query → 全命中）。 */
export function matchesEventSearch(
  ev: Pick<CalendarEvent, 'customerName' | 'caseNumber' | 'typeLabel'>,
  query: string,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return `${ev.customerName} ${ev.caseNumber} ${ev.typeLabel}`.toLowerCase().includes(q)
}

/** 事件按本地日期归集：Map<YYYY-MM-DD, CalendarEvent[]>（每天内按类型稳定排序）。 */
const KIND_ORDER: Record<CalendarEventKind, number> = { reminder: 0, docs: 1, refused: 2, approved: 3, lodged: 4 }
export function eventsByDay(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const m = new Map<string, CalendarEvent[]>()
  for (const e of events) {
    const arr = m.get(e.date) ?? []
    arr.push(e)
    m.set(e.date, arr)
  }
  for (const arr of m.values()) {
    arr.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.customerName.localeCompare(b.customerName))
  }
  return m
}
