/**
 * 「组码」：纯派生，不入库。形如 G-1A2B（根 id 的稳定 4 位 base36 大写哈希）。
 * 一案一组：现行组码由 lib/caseGroups 的 caseGroupCode（参与人集合键）调用本函数派生。
 */

/** 稳定哈希（djb2 变体）→ 无符号 32 位整数。 */
function hash32(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = (((h << 5) + h) + s.charCodeAt(i)) >>> 0
  }
  return h >>> 0
}

// 36^4 = 1,679,616 → 恰好 4 位 base36，取模保留低位熵、分布均匀。
const CODE_SPACE = 36 ** 4

/** 由「组根 id」派生组码。空 id → G-0000。 */
export function groupCode(rootId: string): string {
  if (!rootId) return 'G-0000'
  const code = (hash32(rootId) % CODE_SPACE).toString(36).toUpperCase().padStart(4, '0')
  return `G-${code}`
}
