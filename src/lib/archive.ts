import { DOC_TYPE_LABELS } from '../types/domain'
import type { Case, CaseDocument, Customer, Payment, Profile } from '../types/models'

/**
 * 「档案库」聚合：把三类来源合并成一张统一文件表展示——
 *  1) 客户/案件文件（documents 表，仅取确有实体文件 storage_path 的行）
 *  2) 付款发票（payments.invoice_path）
 * 不改数据库，纯前端聚合 + 派生。下载复用 documents 的 signed URL 机制。
 */

export type ArchiveSource = 'document' | 'invoice'

export interface ArchiveFile {
  /** 列表行唯一 key：`${source}:${sourceId}` */
  key: string
  source: ArchiveSource
  /** 删除定位：document → documents.id；invoice → payments.id */
  sourceId: string
  /** Storage 路径（私有 bucket case-files），下载用 */
  storagePath: string
  fileName: string
  /** 类型键：发票固定 'invoice'，文件用 doc_type */
  typeKey: string
  /** 中文类型标签：发票 / 护照 / 体检 / … */
  typeLabel: string
  customerId: string | null
  customerName: string
  caseId: string | null
  visaSubclass: string | null
  /** 上传/记录时间（created_at），用于显示与排序 */
  uploadedAt: string | null
  uploadedById: string | null
  uploadedByName: string
}

interface LookupMaps {
  caseById: Record<string, Case>
  customerById: Record<string, Customer>
  profileById: Record<string, Profile>
}

const INVOICE_TYPE_KEY = 'invoice'
const INVOICE_TYPE_LABEL = '发票'
const NO_NAME = '—'

function uploaderName(id: string | null, profileById: Record<string, Profile>): string {
  if (!id) return NO_NAME
  return profileById[id]?.full_name ?? NO_NAME
}

export function selectArchiveFiles(
  documents: CaseDocument[],
  payments: Payment[],
  { caseById, customerById, profileById }: LookupMaps,
): ArchiveFile[] {
  const files: ArchiveFile[] = []

  for (const d of documents) {
    if (!d.storage_path) continue // 只展示确有实体文件的行（纯到期登记无文件 → 跳过）
    const cs = d.case_id ? caseById[d.case_id] : undefined
    files.push({
      key: `document:${d.id}`,
      source: 'document',
      sourceId: d.id,
      storagePath: d.storage_path,
      fileName: d.file_name || d.title || '（未命名）',
      typeKey: d.doc_type,
      typeLabel: DOC_TYPE_LABELS[d.doc_type] ?? d.doc_type,
      customerId: d.customer_id,
      customerName: customerById[d.customer_id]?.full_name ?? '',
      caseId: d.case_id,
      visaSubclass: cs?.visa_subclass ?? null,
      uploadedAt: d.created_at,
      uploadedById: d.uploaded_by,
      uploadedByName: uploaderName(d.uploaded_by, profileById),
    })
  }

  for (const p of payments) {
    if (!p.invoice_path) continue
    const cs = caseById[p.case_id]
    const customerId = cs?.customer_id ?? null
    files.push({
      key: `invoice:${p.id}`,
      source: 'invoice',
      sourceId: p.id,
      storagePath: p.invoice_path,
      fileName: p.invoice_name || '发票',
      typeKey: INVOICE_TYPE_KEY,
      typeLabel: INVOICE_TYPE_LABEL,
      customerId,
      customerName: customerId ? customerById[customerId]?.full_name ?? '' : '',
      caseId: p.case_id,
      visaSubclass: cs?.visa_subclass ?? null,
      uploadedAt: p.created_at,
      uploadedById: p.recorded_by,
      uploadedByName: uploaderName(p.recorded_by, profileById),
    })
  }

  // 默认按上传时间倒序（最新在前）
  return files.sort((a, b) => (b.uploadedAt ?? '').localeCompare(a.uploadedAt ?? ''))
}

// ── 筛选 ──────────────────────────────────────────────────────
export interface ArchiveFilters {
  /** 'all' 或具体 typeKey */
  typeKey?: string
  /** 'all' 或具体客户 id */
  customerId?: string
  /** YYYY-MM-DD，按 uploadedAt 的日期前缀比较（含端点） */
  dateFrom?: string
  dateTo?: string
  /** 模糊匹配 文件名 / 客户名（不区分大小写） */
  search?: string
}

export function filterArchiveFiles(files: ArchiveFile[], f: ArchiveFilters): ArchiveFile[] {
  const term = f.search?.trim().toLowerCase()
  return files.filter((file) => {
    if (f.typeKey && f.typeKey !== 'all' && file.typeKey !== f.typeKey) return false
    if (f.customerId && f.customerId !== 'all' && file.customerId !== f.customerId) return false
    const day = file.uploadedAt ? file.uploadedAt.slice(0, 10) : ''
    if (f.dateFrom && (!day || day < f.dateFrom)) return false
    if (f.dateTo && (!day || day > f.dateTo)) return false
    if (term) {
      const hay = `${file.fileName} ${file.customerName}`.toLowerCase()
      if (!hay.includes(term)) return false
    }
    return true
  })
}

// ── 排序 ──────────────────────────────────────────────────────
export type ArchiveSortKey = 'date' | 'customer' | 'type'
export type SortDir = 'asc' | 'desc'

export function sortArchiveFiles(
  files: ArchiveFile[],
  key: ArchiveSortKey,
  dir: SortDir = 'desc',
): ArchiveFile[] {
  const mul = dir === 'asc' ? 1 : -1
  const byDate = (a: ArchiveFile, b: ArchiveFile) => (a.uploadedAt ?? '').localeCompare(b.uploadedAt ?? '')
  const cmp = (a: ArchiveFile, b: ArchiveFile): number => {
    switch (key) {
      case 'customer':
        return a.customerName.localeCompare(b.customerName) || byDate(a, b)
      case 'type':
        return a.typeLabel.localeCompare(b.typeLabel) || byDate(a, b)
      case 'date':
      default:
        return byDate(a, b) || a.key.localeCompare(b.key)
    }
  }
  return [...files].sort((a, b) => mul * cmp(a, b))
}
