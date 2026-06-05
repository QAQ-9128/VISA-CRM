import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  archiveCustomer,
  createCustomer,
  deleteCustomer,
  getCustomer,
  listCustomers,
  updateCustomer,
} from '../../api/customers'
import type { ListCustomersOptions } from '../../api/customers'
import type { CustomerInsert, CustomerUpdate } from '../../types/models'
import { useAuth } from '../useAuth'
import { queryKeys } from './keys'

export function useCustomers(opts: ListCustomersOptions = {}) {
  return useQuery({
    queryKey: queryKeys.customers.list(opts),
    queryFn: () => listCustomers(opts),
  })
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.customers.detail(id ?? ''),
    queryFn: () => getCustomer(id as string),
    enabled: !!id,
  })
}

/** 客户变更后同时失效实体列表与 dashboard 的客户查询（概览各卡片随之同步，如归档后从「待办客户清单」消失）。 */
function invalidateCustomers(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: queryKeys.customers.all })
  qc.invalidateQueries({ queryKey: queryKeys.dashboard.activeCustomers })
}

export function useCreateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CustomerInsert) => createCustomer(input),
    onSuccess: () => invalidateCustomers(qc),
    meta: { success: '客户已创建', errorPrefix: '创建客户失败' },
  })
}

export function useUpdateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: CustomerUpdate }) =>
      updateCustomer(id, patch),
    onSuccess: () => invalidateCustomers(qc),
    meta: { success: '客户已保存', errorPrefix: '保存客户失败' },
  })
}

export function useArchiveCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => archiveCustomer(id),
    onSuccess: () => {
      invalidateCustomers(qc)
      // 单人案件可能被连带归档 → 案件相关缓存一并刷新（递交进度/概览/财务）
      qc.invalidateQueries({ queryKey: queryKeys.cases.all })
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.activeCases })
      qc.invalidateQueries({ queryKey: queryKeys.lodgements.lodged })
    },
    meta: { success: '客户已归档，其参与的案件一并归档（回收站可分别恢复）', errorPrefix: '归档失败' },
  })
}

/** 彻底删除客户（硬删，级联删其案件/文件/账目/记录）。影响面广，成功后失效全部查询缓存。 */
export function useDeleteCustomer() {
  const qc = useQueryClient()
  const { isAdmin } = useAuth()
  return useMutation({
    // 纵深防御：彻底删除是 admin 专属（RLS 同样限制）。入口就拦下非 admin——
    // 删客户是多步流程（过户案件→移出参与人→删客户），被 RLS 静默挡在末步会留脏数据。
    mutationFn: async (id: string) => {
      if (!isAdmin) throw new Error('仅管理员可彻底删除')
      await deleteCustomer(id)
    },
    onSuccess: () => qc.invalidateQueries(),
    meta: { success: '客户已彻底删除', errorPrefix: '删除失败' },
  })
}
