/**
 * 把 ISO 时间戳的「日期」换成 dateStr(YYYY-MM-DD)，保留原时分秒（及时区后缀）。
 * 用于阶段历史「改实际发生日期」：只改日、时分秒沿用默认，避免时区/解析误差。
 */
export function replaceDateKeepTime(iso: string, dateStr: string): string {
  const tIdx = iso.indexOf('T')
  const timePart = tIdx >= 0 ? iso.slice(tIdx + 1) : '00:00:00'
  return `${dateStr}T${timePart}`
}
