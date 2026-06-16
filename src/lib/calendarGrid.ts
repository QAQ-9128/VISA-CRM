/**
 * 月视图网格（纯日历，本地日期，禁 UTC）：**周一为每周第一天**。
 * 行数按需（5 或 6 周），不强制 6 行；每格带本地日期串 + 是否本月。
 * 「今天」高亮由 UI 比较 cell.date === todayYmd() 决定，本函数不掺今天。
 */
export interface CalendarDay {
  /** 本地日历日 YYYY-MM-DD */
  date: string
  /** 几号（1-31） */
  day: number
  /** 是否落在该月内（否则是上/下月补格，淡显） */
  inMonth: boolean
}

/** 本地日历日 YYYY-MM-DD（本地 getters，DST 安全）。自带格式化，不依赖 todayYmd。 */
function localDay(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function monthMatrix(ym: string): CalendarDay[][] {
  const [y, m] = ym.split('-').map(Number) // m: 1-12
  const first = new Date(y, m - 1, 1)
  // 周一首列：JS getDay() 周日=0…周六=6 → 转成 周一=0…周日=6
  const firstWeekday = (first.getDay() + 6) % 7
  const daysInMonth = new Date(y, m, 0).getDate()
  const numWeeks = Math.ceil((firstWeekday + daysInMonth) / 7)

  const weeks: CalendarDay[][] = []
  // 首格 = 本月 1 号往前推到所在周的周一
  let cur = new Date(y, m - 1, 1 - firstWeekday)
  for (let w = 0; w < numWeeks; w++) {
    const week: CalendarDay[] = []
    for (let d = 0; d < 7; d++) {
      week.push({ date: localDay(cur), day: cur.getDate(), inMonth: cur.getMonth() === m - 1 })
      cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1)
    }
    weeks.push(week)
  }
  return weeks
}

/** 周一首列的中文表头。 */
export const WEEKDAY_HEADERS = ['一', '二', '三', '四', '五', '六', '日'] as const

/** 把 'YYYY-MM-DD' 偏移 n 天（本地，DST 安全）。 */
export function shiftDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return localDay(new Date(y, m - 1, d + n))
}

/** 含 dateYmd 的那一周（**周一首日**）7 天，本地日期。周/日视图用。 */
export function weekDays(dateYmd: string): CalendarDay[] {
  const [y, m, d] = dateYmd.split('-').map(Number)
  const wd = (new Date(y, m - 1, d).getDay() + 6) % 7 // 周一=0
  const out: CalendarDay[] = []
  for (let i = 0; i < 7; i++) {
    const dt = new Date(y, m - 1, d - wd + i)
    out.push({ date: localDay(dt), day: dt.getDate(), inMonth: true })
  }
  return out
}
