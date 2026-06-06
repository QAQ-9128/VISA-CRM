import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import {
  archiveDocument,
  createDocument,
  deleteDocument,
  deleteStorageObject,
  listDocumentsByCase,
  listDocumentsByCustomer,
  updateDocument,
  uploadFile,
} from '../../api/documents'
import type { DocumentUpdate } from '../../api/documents'
import type { DocType } from '../../types/domain'
import { useAuth } from '../useAuth'
import { queryKeys } from './keys'

export function useDocumentsByCustomer(customerId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.documents.byCustomer(customerId ?? ''),
    queryFn: () => listDocumentsByCustomer(customerId as string),
    enabled: !!customerId,
  })
}

export function useDocumentsByCase(caseId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.documents.byCase(caseId ?? ''),
    queryFn: () => listDocumentsByCase(caseId as string),
    enabled: !!caseId,
  })
}

/**
 * 文件变更后：documents 前缀（客户文件区 byCustomer / 案件文件区 byCase / 档案库 allList 全覆盖）
 * + 概览「即将到期」（dashboard.expiringDocs 在 dashboard 命名空间下，前缀盖不到，需显式失效）。
 */
function invalidateDocuments(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: queryKeys.documents.all })
  qc.invalidateQueries({ queryKey: queryKeys.dashboard.expiringDocs })
}

export interface AddDocumentInput {
  /** 可选：传文件则上传到 Storage；不传则只登记元数据（如只记到期日） */
  file?: File | null
  customer_id: string
  case_id?: string | null
  doc_type: DocType
  title?: string | null
  issue_date?: string | null
  expiry_date?: string | null
  note?: string | null
}

/** 新建文件：有文件先上传私有 bucket，再写元数据行。 */
export function useAddDocument() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async ({ file, ...fields }: AddDocumentInput) => {
      let storage_path: string | null = null
      let file_name: string | null = null
      if (file) {
        const up = await uploadFile(file, fields.customer_id, fields.case_id ?? null)
        storage_path = up.storage_path
        file_name = up.file_name
      }
      try {
        return await createDocument({
          ...fields,
          storage_path,
          file_name,
          uploaded_by: user?.id ?? null,
        })
      } catch (e) {
        // 补偿：文件已进 Storage 但元数据落库失败 → 删掉刚传的对象，避免无法访问的孤儿文件
        if (storage_path) await deleteStorageObject(storage_path).catch(() => {})
        throw e
      }
    },
    onSuccess: () => invalidateDocuments(qc),
    meta: { success: '文件已保存', errorPrefix: '保存文件失败' },
  })
}

export function useUpdateDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: DocumentUpdate }) => updateDocument(id, patch),
    onSuccess: () => invalidateDocuments(qc),
    meta: { success: '文件已更新', errorPrefix: '更新文件失败' },
  })
}

export function useArchiveDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => archiveDocument(id),
    onSuccess: () => invalidateDocuments(qc),
    meta: { success: '文件已归档（可在档案库恢复）', errorPrefix: '归档失败' },
  })
}

/** 彻底删除文件（回收站终点）：删行 + 清 Storage 实体。 */
export function useDeleteDocument() {
  const qc = useQueryClient()
  return useMutation({
    // 0031 起彻底删除全员开放（两位用户均 staff，2026-06 拍板）
    mutationFn: ({ id, storagePath }: { id: string; storagePath: string | null }) =>
      deleteDocument(id, storagePath),
    onSuccess: () => invalidateDocuments(qc),
    meta: { success: '文件已彻底删除', errorPrefix: '删除失败' },
  })
}
