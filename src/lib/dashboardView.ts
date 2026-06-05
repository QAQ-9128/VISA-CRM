/**
 * 仪表盘「展示层」助手——纯函数，只决定怎么显示，不碰任何数据/聚合/业务逻辑。
 */

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
