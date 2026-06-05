import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { archiveDocument, listAllDocuments } from '../../api/documents'
import { updatePayment } from '../../api/payments'
import { getAllPayments } from '../../api/dashboard'
import { listCases } from '../../api/cases'
import { listCustomers } from '../../api/customers'
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
  // 名字解析含归档（客户/案件归档后，其历史文件的「关联到」仍要显示出处，不能变（未知客户））
  const cases = useQuery({
    queryKey: [...queryKeys.cases.list, { includeArchived: true }],
    queryFn: () => listCases({ includeArchived: true }),
    refetchOnMount: 'always',
  })
  const customers = useQuery({
    queryKey: queryKeys.customers.list({ includeArchived: true }),
    queryFn: () => listCustomers({ includeArchived: true }),
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

  // 客户筛选下拉只列在册客户：归档客户的文件已从列表隐藏（selectArchiveFiles），
  // 下拉再列出来既无意义又把归档物泄漏到回收站之外。
  const activeCustomers = useMemo(
    () => (customers.data ?? []).filter((c) => !c.is_archived),
    [customers.data],
  )

  return { isPending, isError, files, customers: activeCustomers }
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
      // 删的文件可能带到期日 → 概览「即将到期」同步（dashboard 命名空间，documents 前缀盖不到）
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.expiringDocs })
    },
    meta: { success: '已删除', errorPrefix: '删除失败' },
  })
}
