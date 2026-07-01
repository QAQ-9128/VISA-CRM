/**
 * 仪表盘「展示层」助手——纯函数，只决定怎么显示，不碰任何数据/聚合/业务逻辑。
 */

import type { ExpiringDocItem } from './dashboard'
import type { TrtReminderItem } from './trt'
import type { CohabReminderItem } from './cohab'

// ── 临近到期：紧急度分色（单一来源）+ 多源合并 ──────────────────────────
export type DueUrgency = 'red' | 'amber' | 'green'

/**
 * 临近到期紧急度阈值的**单一来源**（概览右栏左竖条 + 数字色）：
 *   逾期或 ≤7 天 → 红；8–14 天 → 黄；15–30 天 → 绿。
 * 入参 daysRemaining 为「本地澳洲日期」口径的剩余天数（负=已逾期）。
 */
export function dueUrgency(daysRemaining: number): DueUrgency {
  if (daysRemaining <= 7) return 'red'
  if (daysRemaining <= 14) return 'amber'
  return 'green'
}

export interface DueSoonItem {
  key: string
  customerId: string
  customerName: string
  /** 事项，如「护照到期」「转 186 TRT 可办」「更新同居材料」 */
  matter: string
  /** 右侧紧凑文案，如「3 天后到期」「已逾期 5 天」「可办」 */
  detail: string
  /** 排序/分色用剩余天数（循环类提醒已到点 → 0） */
  daysRemaining: number
  urgency: DueUrgency
  to: string
}

/**
 * 把现有三类「临近到期」派生数据（文档/签证到期、转 186 TRT、更新同居材料）合并成
 * 统一行项，按剩余天数升序（逾期最前）。不新增任何数据源，纯展示层组装。
 * TRT/同居为「满周期即可办」的循环提醒（无具体到期日）→ 视为已到点（0 天）归红。
 */
export function buildDueSoonList(
  docs: ExpiringDocItem[],
  trt: TrtReminderItem[],
  cohab: CohabReminderItem[],
): DueSoonItem[] {
  const items: DueSoonItem[] = []
  for (const d of docs) {
    items.push({
      key: `doc-${d.id}`,
      customerId: d.customerId,
      customerName: d.customerName,
      matter: d.label,
      detail: d.status === 'overdue' ? `已逾期 ${-d.daysRemaining} 天` : `${d.daysRemaining} 天后到期`,
      daysRemaining: d.daysRemaining,
      urgency: dueUrgency(d.daysRemaining),
      to: `/customers/${d.customerId}`,
    })
  }
  for (const t of trt) {
    items.push({
      key: `trt-${t.caseId}`,
      customerId: t.customerId,
      customerName: t.customerName,
      matter: '转 186 TRT 可办',
      detail: `下签 ${t.monthsSinceGrant} 个月`,
      daysRemaining: 0,
      urgency: 'red',
      to: `/customers/${t.customerId}`,
    })
  }
  for (const t of cohab) {
    items.push({
      key: `cohab-${t.caseId}`,
      customerId: t.customerId,
      customerName: t.customerName,
      matter: '更新同居材料',
      detail: `距上次 ${t.monthsSince} 个月`,
      daysRemaining: 0,
      urgency: 'red',
      to: `/customers/${t.customerId}?case=${t.caseId}`,
    })
  }
  return items.sort((a, b) => a.daysRemaining - b.daysRemaining || a.key.localeCompare(b.key))
}

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
 * 客户名兜底：空白名时显示 fallback（默认「未命名」）。
 * 有案件上下文时可传更有意义的兜底，如签证类型 / 案件参考号，避免一片「未命名」。
 */
export function displayCustomerName(name?: string | null, fallback = '未命名'): string {
  const n = name?.trim()
  return n ? n : fallback || '未命名'
}

/** KPI 角标「N 户欠款」：欠你钱（clientOwes>0）的客户数；仅欠主代理的不算。 */
export function countOwingCustomers(debts: { clientOwes: number }[]): number {
  return debts.filter((d) => d.clientOwes > 0).length
}
