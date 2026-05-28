/**
 * 归档客户的案件应从概览 / 财务 / 案件表隐藏（归档客户=不在册）。
 * 返回「主申客户仍在册」的案件 id 集合；customerById 来自未归档客户列表。
 * 纯视图层过滤，不改数据：客户恢复后其案件自动重新出现。
 */
export function visibleCaseIds(
  cases: { id: string; customer_id: string }[],
  customerById: Record<string, unknown>,
): Set<string> {
  return new Set(cases.filter((c) => customerById[c.customer_id]).map((c) => c.id))
}
