import { utcDayDiff } from './dateDiff'
import { localYmd } from './dateRules'

/**
 * 案件提醒的日期推算（纯函数，全本地日历日，禁 UTC）：
 *  - 首次到期 = 创建日 + offset（天/月/年）；月/年加法对月末做夹取（1/31 + 1月 → 2/28）。
 *  - 重复规则照 iOS 提醒事项整套；occurrencesInMonth 列出某月内全部到期日（日历紫点用）。
 * 账目无关、不写库派生。
 */

export type OffsetUnit = 'day' | 'month' | 'year'
export const OFFSET_UNITS: { value: OffsetUnit; label: string }[] = [
  { value: 'day', label: '天' },
  { value: 'month', label: '月' },
  { value: 'year', label: '年' },
]

export type RepeatRule =
  | 'never' | 'hourly' | 'daily' | 'weekdays' | 'weekends' | 'weekly'
  | 'biweekly' | 'monthly' | 'every3months' | 'every6months' | 'yearly' | 'custom'

/** 重复规则下拉（照 iOS 提醒事项）。 */
export const REPEAT_RULES: { value: RepeatRule; label: string }[] = [
  { value: 'never', label: '永不' },
  { value: 'hourly', label: '每小时' },
  { value: 'daily', label: '每天' },
  { value: 'weekdays', label: '工作日' },
  { value: 'weekends', label: '周末' },
  { value: 'weekly', label: '每周' },
  { value: 'biweekly', label: '每两周' },
  { value: 'monthly', label: '每月' },
  { value: 'every3months', label: '每 3 个月' },
  { value: 'every6months', label: '每 6 个月' },
  { value: 'yearly', label: '每年' },
  { value: 'custom', label: '自定义' },
]
export const REPEAT_RULE_LABEL: Record<RepeatRule, string> = Object.fromEntries(
  REPEAT_RULES.map((r) => [r.value, r.label]),
) as Record<RepeatRule, string>

const parse = (ymd: string): [number, number, number] => {
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number)
  return [y, m, d]
}
const fmt = (d: Date): string => localYmd(d)

/** 加 n 天（本地）。 */
export function addDays(ymd: string, n: number): string {
  const [y, m, d] = parse(ymd)
  return fmt(new Date(y, m - 1, d + n))
}

/** 加 n 个日历月（月末夹取：1/31 + 1月 → 2/28）。 */
export function addMonths(ymd: string, n: number): string {
  const [y, m, d] = parse(ymd)
  const idx = m - 1 + n
  const ty = y + Math.floor(idx / 12)
  const tm = ((idx % 12) + 12) % 12
  const daysIn = new Date(ty, tm + 1, 0).getDate()
  return fmt(new Date(ty, tm, Math.min(d, daysIn)))
}

const WEEK_CN = ['日', '一', '二', '三', '四', '五', '六']
/** 'YYYY-MM-DD' → 中文「2026年6月4日(周四)」（本地日历日，禁 UTC）。 */
export function formatDueCn(ymd: string): string {
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number)
  const wd = new Date(y, m - 1, d).getDay()
  return `${y}年${m}月${d}日(周${WEEK_CN[wd]})`
}

/** 首次到期：基准日(本地日) + offset 个单位。 */
export function firstDueDate(createdYmd: string, value: number, unit: OffsetUnit): string {
  const base = createdYmd.slice(0, 10)
  if (unit === 'day') return addDays(base, value)
  if (unit === 'month') return addMonths(base, value)
  return addMonths(base, value * 12)
}

const isWeekend = (ymd: string): boolean => {
  const [y, m, d] = parse(ymd)
  const wd = new Date(y, m - 1, d).getDay()
  return wd === 0 || wd === 6
}

/** 单步推进（按重复规则）。weekdays/weekends/daily/hourly 都按天推进，再由调用方筛星期。 */
function stepOnce(ymd: string, rule: RepeatRule): string {
  switch (rule) {
    case 'weekly': return addDays(ymd, 7)
    case 'biweekly': return addDays(ymd, 14)
    case 'monthly': return addMonths(ymd, 1)
    case 'every3months': return addMonths(ymd, 3)
    case 'every6months': return addMonths(ymd, 6)
    case 'yearly': return addMonths(ymd, 12)
    default: return addDays(ymd, 1) // daily / hourly / weekdays / weekends
  }
}

/**
 * 某月（'YYYY-MM'）内该提醒的全部到期日（升序）。
 * 'never'/'custom' → 仅首次到期（落在该月才出）；其余按规则在月内列举。
 * 'hourly' 在日历按「每天一点」呈现（日格无法标小时）。
 */
export function occurrencesInMonth(firstYmd: string, rule: RepeatRule, monthYm: string): string[] {
  const first = firstYmd.slice(0, 10)
  const monthStart = `${monthYm}-01`
  const [my, mm] = monthYm.split('-').map(Number)
  const monthEnd = fmt(new Date(my, mm, 0)) // 月末
  if (first > monthEnd) return []

  if (rule === 'never' || rule === 'custom') {
    return first >= monthStart ? [first] : []
  }

  // 从首次到期快进到 >= monthStart 的首个到期日（远古首期也不超迭代）
  let cur = first
  if (cur < monthStart) {
    if (rule === 'weekly' || rule === 'biweekly') {
      const period = rule === 'weekly' ? 7 : 14
      const need = Math.ceil(utcDayDiff(cur, monthStart) / period)
      cur = addDays(cur, need * period)
    } else if (rule === 'monthly' || rule === 'every3months' || rule === 'every6months' || rule === 'yearly') {
      let guard = 0
      while (cur < monthStart && guard++ < 2000) cur = stepOnce(cur, rule)
    } else {
      cur = monthStart // daily / hourly / weekdays / weekends：逐日，从月初起筛
    }
  }

  const out: string[] = []
  let guard = 0
  while (cur <= monthEnd && guard++ < 400) {
    if (cur >= monthStart && cur >= first) {
      if (rule === 'weekends') { if (isWeekend(cur)) out.push(cur) }
      else if (rule === 'weekdays') { if (!isWeekend(cur)) out.push(cur) }
      else out.push(cur)
    }
    cur = stepOnce(cur, rule)
  }
  return out
}
