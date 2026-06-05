import { supabase } from '../lib/supabase'
import { uploadSizeError } from '../lib/upload'
import type { CaseDocument } from '../types/models'
import type { TablesInsert, TablesUpdate } from '../types/database'

export type DocumentInsert = TablesInsert<'documents'>
export type DocumentUpdate = TablesUpdate<'documents'>

const BUCKET = 'case-files'
/** 签名 URL 有效期（秒）。私有 bucket，绝不暴露公开 URL。 */
const SIGNED_URL_TTL = 60

/** 某客户的全部文件，默认排除归档，按到期日升序（快过期的靠前）。 */
export async function listDocumentsByCustomer(
  customerId: string,
  opts: { includeArchived?: boolean } = {},
): Promise<CaseDocument[]> {
  let query = supabase.from('documents').select('*').eq('customer_id', customerId)
  if (!opts.includeArchived) query = query.eq('is_archived', false)
  query = query.order('expiry_date', { ascending: true, nullsFirst: false })
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

/** 某案件挂的文件。 */
export async function listDocumentsByCase(
  caseId: string,
  opts: { includeArchived?: boolean } = {},
): Promise<CaseDocument[]> {
  let query = supabase.from('documents').select('*').eq('case_id', caseId)
  if (!opts.includeArchived) query = query.eq('is_archived', false)
  query = query.order('expiry_date', { ascending: true, nullsFirst: false })
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

/** 全部已上传文件（排除归档、仅含有实体文件 storage_path 的），按上传时间倒序。用于「档案库」聚合。 */
export async function listAllDocuments(): Promise<CaseDocument[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('is_archived', false)
    .not('storage_path', 'is', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createDocument(input: DocumentInsert): Promise<CaseDocument> {
  const { data, error } = await supabase.from('documents').insert(input).select().single()
  if (error) throw error
  return data
}

export async function updateDocument(id: string, patch: DocumentUpdate): Promise<CaseDocument> {
  const { data, error } = await supabase
    .from('documents')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/** 归档 = 软删除（不删 Storage 里的实体文件）。 */
export async function archiveDocument(id: string): Promise<void> {
  const { error } = await supabase.from('documents').update({ is_archived: true }).eq('id', id)
  if (error) throw error
}

/**
 * 彻底删除文件（回收站终点，不可恢复）：删除 documents 行，并尽力删除 Storage 实体
 * （行删成功后实体清理失败不报错——文件已不可见，残留对象不影响业务）。RLS 删行仅 admin。
 */
export async function deleteDocument(id: string, storagePath: string | null): Promise<void> {
  const { error } = await supabase.from('documents').delete().eq('id', id)
  if (error) throw error
  if (storagePath) await deleteStorageObject(storagePath).catch(() => {})
}

/** 取消归档（回收站恢复）。 */
export async function unarchiveDocument(id: string): Promise<void> {
  const { error } = await supabase.from('documents').update({ is_archived: false }).eq('id', id)
  if (error) throw error
}

/** 已归档文件（回收站列表用），按归档时间近似（updated_at）倒序。 */
export async function listArchivedDocuments(): Promise<CaseDocument[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('is_archived', true)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

/** 构造 Storage 路径：customer_id/case_id(或 general)/唯一前缀-安全文件名。 */
export function buildStoragePath(
  customerId: string,
  caseId: string | null,
  fileName: string,
  unique: string = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
): string {
  const scope = caseId ?? 'general'
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `${customerId}/${scope}/${unique}-${safe}`
}

/** 上传文件到私有 bucket case-files，返回入库用的 storage_path + file_name。
 *  全部上传入口（客户文件 / 发票 / 档案）都经这里 → 大小限制在此统一强制。 */
export async function uploadFile(
  file: File,
  customerId: string,
  caseId?: string | null,
): Promise<{ storage_path: string; file_name: string }> {
  const sizeErr = uploadSizeError(file)
  if (sizeErr) throw new Error(sizeErr)
  const path = buildStoragePath(customerId, caseId ?? null, file.name)
  const { error } = await supabase.storage.from(BUCKET).upload(path, file)
  if (error) throw error
  return { storage_path: path, file_name: file.name }
}

/** 删除 Storage 对象（上传后落库失败的补偿清理用）。 */
export async function deleteStorageObject(storagePath: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath])
  if (error) throw error
}

/** 取短时签名 URL 用于下载/预览。未登录/越权由 RLS 返回 403。 */
export async function getDocumentSignedUrl(
  storagePath: string,
  expiresIn: number = SIGNED_URL_TTL,
): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, expiresIn)
  if (error) throw error
  return data.signedUrl
}
