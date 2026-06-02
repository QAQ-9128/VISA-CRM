/**
 * 仪表盘「展示层」助手——纯函数，只决定怎么显示，不碰任何数据/聚合/业务逻辑。
 */
import type { MonthOverMonth } from './dashboard'

/**
 * 问候语用名：有真实姓名显示姓名，否则返回 null（绝不显示邮箱）。
 * 注意：部分账号的 profile.full_name 实际存的是邮箱地址——含「@」即视为无名，
 * 一律返回 null，调用方渲染「你好 👋」。
 */
export function pickGreetingName(fullName?: string | null): string | null {
  const name = fullName?.trim()
  if (!name || name.includes('@')) return null
  return name
}

/**
 * 是否显示本月收款的月环比 chip。
 * 仅在「当前值 > 0」且「有可比的真实涨跌」时显示——
 * 当前值为 0（如 AUD 0.00 的「↓100%」）、上月为 0（pct=null）、或持平无意义时，一律不显示。
 */
export function showReceiptsTrend(currentValue: number, mom: MonthOverMonth): boolean {
  return currentValue > 0 && mom.pct != null && mom.dir !== 'flat'
}

/**
 * 客户名兜底：空白名时显示 fallback（默认「未命名」）。
 * 有案件上下文时可传更有意义的兜底，如签证类型 / 案件参考号，避免一片「未命名」。
 */
export function displayCustomerName(name?: string | null, fallback = '未命名'): string {
  const n = name?.trim()
  return n ? n : fallback || '未命名'
}
