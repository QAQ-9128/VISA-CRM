/**
 * 案件可见性（概览 / 财务 / 递交进度 / 新建客户加入案件 共用同一口径）：
 * 一案一组、参与人平级 —— 只要案件还有**任何一个在册参与人**（案件客户或 case_applicants 成员），
 * 案件就可见；全员归档才隐藏。纯视图层过滤，不改数据：恢复任一参与人后案件自动重新出现。
 * customerById 来自未归档客户列表；applicants 不传时退回旧口径（仅看案件客户）。
 */
export function visibleCaseIds(
  cases: { id: string; customer_id: string }[],
  customerById: Record<string, unknown>,
  applicants: { case_id: string; customer_id: string }[] = [],
): Set<string> {
  // 有在册参与人的案件集合（participants 视角）
  const hasActiveParticipant = new Set<string>()
  for (const a of applicants) {
    if (customerById[a.customer_id]) hasActiveParticipant.add(a.case_id)
  }
  return new Set(
    cases
      .filter((c) => customerById[c.customer_id] || hasActiveParticipant.has(c.id))
      .map((c) => c.id),
  )
}
