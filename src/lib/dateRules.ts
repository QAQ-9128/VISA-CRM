/**
 * 表单日期方向规则（纯函数）：
 * - 阶段「实际发生日期」记录已发生的事 → 不允许未来；
 * - 待办「截止日期」是计划 → 不允许过去。
 * 字符串 YYYY-MM-DD 直接比大小（同格式字典序 = 时间序，DST 安全）。
 */

/** 今天的 YYYY-MM-DD（本地日历日）。 */
export function todayYmd(today: Date = new Date()): string {
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 任意时刻的本地日历日 YYYY-MM-DD（与 todayYmd 同实现，语义别名：用于展示历史时间戳的日期部分）。 */
export function localYmd(date: Date): string {
  return todayYmd(date)
}

/** 是否晚于今天（未来）；空值不算。 */
export function isFutureYmd(ymd: string | null | undefined, today: string = todayYmd()): boolean {
  return !!ymd && ymd > today
}

/** 是否早于今天（过去）；空值不算。 */
export function isPastYmd(ymd: string | null | undefined, today: string = todayYmd()): boolean {
  return !!ymd && ymd < today
}

// ── 澳洲财年（7/1 → 次年 6/30，按结束年命名：2025-07-01~2026-06-30 =「2025–26 财年」）──

export interface FinancialYear {
  /** 结束年 = 命名年（2026 → 2025–26 财年）；‹ › 切换就是 ±1 */
  endYear: number
  startYmd: string
  endYmd: string
  /** 「2025–26 财年」（en dash） */
  label: string
}

/** 由结束年构造财年区间（纯算术，无 Date）。 */
export function fyOfEndYear(endYear: number): FinancialYear {
  return {
    endYear,
    startYmd: `${endYear - 1}-07-01`,
    endYmd: `${endYear}-06-30`,
    label: `${endYear - 1}–${String(endYear).slice(-2)} 财年`,
  }
}

/**
 * 某个本地时刻所在的澳洲财年。必须用本地 getters（getMonth/getFullYear）——
 * 本地 6/30 23:00 在 UTC 已是 7/1，会被误归下一财年。
 */
export function auFinancialYear(localDate: Date = new Date()): FinancialYear {
  const july = 6 // getMonth() 0 起
  const endYear = localDate.getMonth() >= july ? localDate.getFullYear() + 1 : localDate.getFullYear()
  return fyOfEndYear(endYear)
}

/** 'YYYY-MM' 所属财年（≥7 月归下一结束年）。月度→财年切换联动用。 */
export function fyOfMonth(ym: string): FinancialYear {
  const [y, m] = ym.split('-').map(Number)
  return fyOfEndYear(m >= 7 ? y + 1 : y)
}

/** 把 'YYYY-MM' 夹进财年范围：财年内原样；早于→财年首月；晚于→财年末月。财年→月度切换联动用。 */
export function clampMonthToFy(ym: string, fy: FinancialYear): string {
  const start = fy.startYmd.slice(0, 7)
  const end = fy.endYmd.slice(0, 7)
  return ym < start ? start : ym > end ? end : ym
}

/** 财年直选器的可选结束年范围（含两端）。 */
export interface FyBounds {
  minEndYear: number
  maxEndYear: number
}

/**
 * 财年直选器范围：从「最早记录月所属财年」→「当前财年」（按结束年）。
 * 无记录（earliest 空）→ 仅当前财年。earliest 异常（晚于当前）按无记录处理。
 */
export function fyPickerBounds(earliest: string | null | undefined, currentEndYear: number): FyBounds {
  const earliestEndYear = earliest ? fyOfMonth(earliest).endYear : currentEndYear
  const minEndYear = Math.min(earliestEndYear, currentEndYear)
  return { minEndYear, maxEndYear: currentEndYear }
}
