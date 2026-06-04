import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import {
  archiveDocument,
  createDocument,
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
      return createDocument({
        ...fields,
        storage_path,
        file_name,
        uploaded_by: user?.id ?? null,
      })
    },
    onSuccess: () => invalidateDocuments(qc),
  })
}

export function useUpdateDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: DocumentUpdate }) => updateDocument(id, patch),
    onSuccess: () => invalidateDocuments(qc),
  })
}

export function useArchiveDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => archiveDocument(id),
    onSuccess: () => invalidateDocuments(qc),
  })
}
