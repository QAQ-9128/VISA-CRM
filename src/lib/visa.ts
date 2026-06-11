/**
 * 签证展示工具。案件类型录入已统一走级联（src/lib/caseTypeCascade.ts），旧的大签证目录
 * (VISA_CATALOG) / findVisaType / visaCategoryLabel / hasStreamOptions 已随之删除。
 * 这里只保留与目录无关的纯展示拼接，供全站只读展示用。
 */

/** 合并显示：有子类别显示「类别/子类别」(如 482/Core Skills)，否则仅类别(如 820/801)。 */
export function formatVisaType(subclass: string, stream?: string | null): string {
  const st = stream?.trim()
  return st ? `${subclass}/${st}` : subclass
}
