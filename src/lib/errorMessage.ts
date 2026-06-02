/**
 * 从未知错误里抽出可读信息——别再吞掉后端真实原因。
 * 兼容 Error 实例、字符串、以及 Supabase 的 PostgrestError（普通对象，含 message/details/hint/code，
 * 不是 Error 实例，所以 `instanceof Error` 抓不到）。
 */
export function errorMessage(e: unknown): string | null {
  if (e == null) return null
  if (typeof e === 'string') return e.trim() || null
  if (e instanceof Error) return e.message || null
  if (typeof e === 'object') {
    const o = e as Record<string, unknown>
    const parts = [o.message, o.details, o.hint]
      .filter((x): x is string => typeof x === 'string' && x.trim() !== '')
    const code = typeof o.code === 'string' && o.code.trim() !== '' ? ` [${o.code}]` : ''
    if (parts.length > 0) return parts.join(' · ') + code
    if (code) return code.trim()
  }
  try {
    return JSON.stringify(e)
  } catch {
    return String(e)
  }
}
