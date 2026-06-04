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
  })
}

export function useUpdateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: CustomerUpdate }) =>
      updateCustomer(id, patch),
    onSuccess: () => invalidateCustomers(qc),
  })
}

export function useArchiveCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => archiveCustomer(id),
    onSuccess: () => invalidateCustomers(qc),
  })
}

/** 彻底删除客户（硬删，级联删其案件/文件/账目/记录）。影响面广，成功后失效全部查询缓存。 */
export function useDeleteCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCustomer(id),
    onSuccess: () => qc.invalidateQueries(),
  })
}
