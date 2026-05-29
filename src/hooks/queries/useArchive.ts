import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { archiveDocument, listAllDocuments } from '../../api/documents'
import { updatePayment } from '../../api/payments'
import { getActiveCases, getActiveCustomers, getAllPayments } from '../../api/dashboard'
import { selectArchiveFiles } from '../../lib/archive'
import type { ArchiveFile } from '../../lib/archive'
import { useProfiles } from './useProfiles'
import { queryKeys } from './keys'

function keyById<T extends { id: string }>(rows: T[]): Record<string, T> {
  const map: Record<string, T> = {}
  for (const r of rows) map[r.id] = r
  return map
}

/**
 * 「档案库」数据：合并 documents 文件 + payments 发票为统一列表。
 * 复用 dashboard 的 cases/customers/payments 查询键 → 与财务/概览共享缓存、删除即同步。
 */
export function useArchiveFiles() {
  // 档案库是低频管理视图：每次打开都强制拉最新（refetchOnMount: 'always'），
  // 避免「刚在别处上传/删了文件，回到档案库却因 30s staleTime 命中旧缓存而看不到」。
  const documents = useQuery({
    queryKey: queryKeys.documents.allList,
    queryFn: listAllDocuments,
    refetchOnMount: 'always',
  })
  const payments = useQuery({
    queryKey: queryKeys.dashboard.payments,
    queryFn: getAllPayments,
    refetchOnMount: 'always',
  })
  const cases = useQuery({
    queryKey: queryKeys.dashboard.activeCases,
    queryFn: getActiveCases,
    refetchOnMount: 'always',
  })
  const customers = useQuery({
    queryKey: queryKeys.dashboard.activeCustomers,
    queryFn: getActiveCustomers,
    refetchOnMount: 'always',
  })
  const profiles = useProfiles()

  const all = [documents, payments, cases, customers, profiles]
  const isPending = all.some((q) => q.isPending)
  const isError = all.some((q) => q.isError)

  const caseById = useMemo(() => keyById(cases.data ?? []), [cases.data])
  const customerById = useMemo(() => keyById(customers.data ?? []), [customers.data])
  const profileById = useMemo(() => keyById(profiles.data ?? []), [profiles.data])

  const files = useMemo(
    () =>
      selectArchiveFiles(documents.data ?? [], payments.data ?? [], {
        caseById,
        customerById,
        profileById,
      }),
    [documents.data, payments.data, caseById, customerById, profileById],
  )

  return { isPending, isError, files, customers: customers.data ?? [] }
}

/**
 * 删除一条档案：
 *  - 文件(document) → 软删 documents 行（is_archived，符合全站软删约定；从客户/案件文件区也一并消失）；
 *  - 发票(invoice)  → 清空该付款的 invoice_path/invoice_name（保留付款本身，仅移除附件）。
 * 不删 Storage 实体（与现有 archiveDocument 行为一致）。
 */
export function useDeleteArchiveFile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: ArchiveFile) => {
      if (file.source === 'invoice') {
        await updatePayment(file.sourceId, { invoice_path: null, invoice_name: null })
      } else {
        await archiveDocument(file.sourceId)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.documents.all })
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.payments })
    },
  })
}
