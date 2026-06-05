import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listCustomers, unarchiveCustomer } from '../../api/customers'
import { listCases, unarchiveCase } from '../../api/cases'
import { listArchivedDocuments, unarchiveDocument } from '../../api/documents'
import { listEmployers, unarchiveEmployer } from '../../api/employers'
import { listReferrers, unarchiveReferrer } from '../../api/referrers'
import { queryKeys } from './keys'

/**
 * 回收站（档案库「回收站」tab）：列出全部已归档实体 + 一键恢复。
 * 归档=软删（is_archived），恢复=置回 false，原数据与外键关系原样回来。
 * 客户/案件查询与档案库共用同一 includeArchived 键（共享缓存），各实体前缀失效即同步。
 */
export function useRecycleBin() {
  const customers = useQuery({
    queryKey: queryKeys.customers.list({ includeArchived: true }),
    queryFn: () => listCustomers({ includeArchived: true }),
    refetchOnMount: 'always',
  })
  const cases = useQuery({
    queryKey: [...queryKeys.cases.list, { includeArchived: true }],
    queryFn: () => listCases({ includeArchived: true }),
    refetchOnMount: 'always',
  })
  const documents = useQuery({
    queryKey: [...queryKeys.documents.all, 'archived'],
    queryFn: listArchivedDocuments,
    refetchOnMount: 'always',
  })
  const employers = useQuery({
    queryKey: [...queryKeys.employers.list, { includeArchived: true }],
    queryFn: () => listEmployers({ includeArchived: true }),
    refetchOnMount: 'always',
  })
  const referrers = useQuery({
    queryKey: [...queryKeys.referrers.list, { includeArchived: true }],
    queryFn: () => listReferrers({ includeArchived: true }),
    refetchOnMount: 'always',
  })

  const all = [customers, cases, documents, employers, referrers]
  const isPending = all.some((q) => q.isPending)
  const isError = all.some((q) => q.isError)

  // 在册客户映射：归档案件行显示客户名用（客户本身也可能已归档，同样能解析）
  const customerById = useMemo(
    () => Object.fromEntries((customers.data ?? []).map((c) => [c.id, c])),
    [customers.data],
  )

  return {
    isPending,
    isError,
    archivedCustomers: useMemo(() => (customers.data ?? []).filter((c) => c.is_archived), [customers.data]),
    archivedCases: useMemo(() => (cases.data ?? []).filter((c) => c.is_archived), [cases.data]),
    archivedDocuments: documents.data ?? [],
    archivedEmployers: useMemo(() => (employers.data ?? []).filter((e) => e.is_archived), [employers.data]),
    archivedReferrers: useMemo(() => (referrers.data ?? []).filter((r) => r.is_archived), [referrers.data]),
    customerById,
  }
}

const META = { success: '已恢复', errorPrefix: '恢复失败' }

export function useUnarchiveCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => unarchiveCustomer(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.customers.all })
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.activeCustomers })
    },
    meta: META,
  })
}

export function useUnarchiveCase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => unarchiveCase(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.cases.all })
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.activeCases })
    },
    meta: META,
  })
}

export function useUnarchiveDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => unarchiveDocument(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.documents.all })
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.expiringDocs })
    },
    meta: META,
  })
}

export function useUnarchiveEmployer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => unarchiveEmployer(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.employers.all }),
    meta: META,
  })
}

export function useUnarchiveReferrer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => unarchiveReferrer(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.referrers.all })
      qc.invalidateQueries({ queryKey: queryKeys.finance.referrers })
    },
    meta: META,
  })
}
