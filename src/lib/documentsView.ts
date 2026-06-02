import { computeExpiryStatus } from './expiry'
import { DOC_TYPES, DOC_TYPE_LABELS } from '../types/domain'
import type { DocType } from '../types/domain'
import type { CaseDocument } from '../types/models'

// ── 文件状态（按真实字段派生，不伪造审核工作流）──────────────
export type DocStatusKind = 'pending' | 'overdue' | 'soon' | 'ok'
export interface DocStatus {
  kind: DocStatusKind
  label: string
}

/**
 * 文件状态：无文件(storage_path 空) = 待上传；有文件且有到期日 → 已过期 / 即将到期(≤30天)；
 * 其余 = 有效。全部来自真实列（storage_path / expiry_date），不引入数据库没有的审核状态。
 */
export function docStatus(
  doc: Pick<CaseDocument, 'storage_path' | 'expiry_date'>,
  today: Date = new Date(),
): DocStatus {
  if (!doc.storage_path) return { kind: 'pending', label: '待上传' }
  const exp = computeExpiryStatus(doc.expiry_date, today)
  if (exp?.status === 'overdue') return { kind: 'overdue', label: '已过期' }
  if (exp?.status === 'soon') return { kind: 'soon', label: '即将到期' }
  return { kind: 'ok', label: '有效' }
}

// ── 分类 facets（只列出现有 doc_type，按枚举顺序）───────────
export interface DocCategoryFacet {
  type: DocType
  label: string
  count: number
}

/** 现有文件按 doc_type 分组计数；只返回真实出现过的类别，顺序follows DOC_TYPES。 */
export function selectDocCategories(docs: Pick<CaseDocument, 'doc_type'>[]): DocCategoryFacet[] {
  const counts = new Map<DocType, number>()
  for (const d of docs) counts.set(d.doc_type, (counts.get(d.doc_type) ?? 0) + 1)
  return DOC_TYPES.filter((t) => counts.has(t)).map((t) => ({
    type: t,
    label: DOC_TYPE_LABELS[t],
    count: counts.get(t) ?? 0,
  }))
}

// ── 文件名 / 展示名 ──────────────────────────────────────────
export function docDisplayName(doc: Pick<CaseDocument, 'title' | 'file_name'>): string {
  return doc.title || doc.file_name || '（未命名）'
}

// ── 列表过滤（分类 + 搜索 + 状态）────────────────────────────
export interface DocFilter {
  category: DocType | 'all'
  search: string
  status: DocStatusKind | 'all'
}

/** 按分类(doc_type)、文件名搜索、派生状态过滤；任一为 all/空则不限。 */
export function filterDocs(
  docs: CaseDocument[],
  filter: DocFilter,
  today: Date = new Date(),
): CaseDocument[] {
  const q = filter.search.trim().toLowerCase()
  return docs.filter((d) => {
    if (filter.category !== 'all' && d.doc_type !== filter.category) return false
    if (filter.status !== 'all' && docStatus(d, today).kind !== filter.status) return false
    if (q) {
      const hay = `${d.title ?? ''} ${d.file_name ?? ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

// ── 指标 ─────────────────────────────────────────────────────
export interface RecentUpload {
  date: string
  name: string
  uploaderId: string | null
}

/** 最近上传：按 created_at 取最新一条（有真实 created_at 才计）。无文件则 null。 */
export function recentUpload(docs: CaseDocument[]): RecentUpload | null {
  let best: CaseDocument | null = null
  for (const d of docs) {
    if (!d.created_at) continue
    if (!best || d.created_at > best.created_at) best = d
  }
  if (!best) return null
  return { date: best.created_at.slice(0, 10), name: docDisplayName(best), uploaderId: best.uploaded_by }
}

/** uploaded_by → 用户名：当前用户显示「我」；profiles 命中显示其名；都没有则 null（不编造）。 */
export function resolveUploader(
  uploaderId: string | null,
  profilesById: Map<string, string | null>,
  currentUserId?: string | null,
): string | null {
  if (!uploaderId) return null
  if (currentUserId && uploaderId === currentUserId) return '我'
  return profilesById.get(uploaderId) ?? null
}
