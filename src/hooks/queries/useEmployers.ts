import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  archiveEmployer,
  createEmployer,
  deleteEmployer,
  getEmployer,
  listEmployers,
  updateEmployer,
} from '../../api/employers'
import type { EmployerInsert, EmployerUpdate } from '../../api/employers'
import { useAuth } from '../useAuth'
import { queryKeys } from './keys'

export function useEmployers() {
  return useQuery({ queryKey: queryKeys.employers.list, queryFn: () => listEmployers() })
}

export function useEmployer(id: string | undefined | null) {
  return useQuery({
    queryKey: queryKeys.employers.detail(id ?? ''),
    queryFn: () => getEmployer(id as string),
    enabled: !!id,
  })
}

export function useCreateEmployer() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: (input: EmployerInsert) => createEmployer({ ...input, created_by: user?.id ?? null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.employers.all }),
    meta: { success: '雇主已创建', errorPrefix: '创建雇主失败' },
  })
}

export function useUpdateEmployer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: EmployerUpdate }) => updateEmployer(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.employers.all }),
    meta: { success: '雇主已保存', errorPrefix: '保存雇主失败' },
  })
}

export function useArchiveEmployer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => archiveEmployer(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.employers.all }),
    meta: { success: '雇主已归档', errorPrefix: '归档失败' },
  })
}

/** 彻底删除雇主（硬删）。已挂靠客户的 sponsor_employer_id 被置空 → 同时失效客户/概览缓存。 */
export function useDeleteEmployer() {
  const qc = useQueryClient()
  const { isAdmin } = useAuth()
  return useMutation({
    // 纵深防御：彻底删除是 admin 专属（RLS 同样限制），入口拦下避免被静默挡掉无提示
    mutationFn: async (id: string) => {
      if (!isAdmin) throw new Error('仅管理员可彻底删除')
      await deleteEmployer(id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.employers.all })
      qc.invalidateQueries({ queryKey: queryKeys.customers.all })
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.activeCustomers })
    },
    meta: { success: '雇主已彻底删除', errorPrefix: '删除失败' },
  })
}
