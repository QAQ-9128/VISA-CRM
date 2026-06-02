/** 头像展示首字符：拉丁大写、其它取首字、空白兜底为「·」。 */
export function avatarInitial(name: string): string {
  const t = name.trim()
  if (!t) return '·'
  const ch = t[0]
  return /[a-z]/i.test(ch) ? ch.toUpperCase() : ch
}
