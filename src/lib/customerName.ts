/**
 * 客户显示名单一来源（2026-06：姓名拆「中文名 + 英文名」）：
 * 有中文名→显中文；没中文→显英文；都没有→兜底旧 full_name（老数据兼容）。
 * 英文名按录入原样显示（如 DENG Tao——姓全大写 + 名首字母大写由录入约定，系统不自动改大小写）。
 *
 * 注意：full_name 在表单保存时同步写为「中文 ?? 英文」（DB not null、排序/搜索沿用），
 * 但**所有展示一律走本函数**——不要再直接读 .full_name 展示客户名。
 */
export interface CustomerNameParts {
  chinese_name?: string | null
  english_name?: string | null
  full_name?: string | null
}

export function customerDisplayName(c: CustomerNameParts | null | undefined): string {
  if (!c) return ''
  const zh = c.chinese_name?.trim()
  if (zh) return zh
  const en = c.english_name?.trim()
  if (en) return en
  return c.full_name?.trim() ?? ''
}
