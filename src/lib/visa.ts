import { VISA_CATALOG } from '../types/visaCatalog'
import type { VisaTypeOption } from '../types/visaCatalog'

/** subclass → 目录里的类型配置（含 name / streams）；目录外(手填)返回 undefined。 */
export function findVisaType(subclass: string): VisaTypeOption | undefined {
  for (const cat of VISA_CATALOG) {
    const t = cat.types.find((x) => x.subclass === subclass)
    if (t) return t
  }
  return undefined
}

/** 该签证类别是否有子类别可选（含「其他(手填)」）。 */
export function hasStreamOptions(subclass: string): boolean {
  const t = findVisaType(subclass)
  return !!t && (t.streams.length > 0 || !!t.allowOtherStream)
}

/** 合并显示：有子类别显示「类别/子类别」(如 482/Core Skills)，否则仅类别(如 820/801)。 */
export function formatVisaType(subclass: string, stream?: string | null): string {
  const st = stream?.trim()
  return st ? `${subclass}/${st}` : subclass
}
