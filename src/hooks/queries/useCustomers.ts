import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  archiveCustomer,
  createCustomer,
  getCustomer,
  getSubApplicants,
  listCustomers,
  listPrimaryApplicants,
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

export function useSubApplicants(primaryId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.customers.subApplicants(primaryId ?? ''),
    queryFn: () => getSubApplicants(primaryId as string),
    enabled: !!primaryId,
  })
}

export function usePrimaryApplicants() {
  return useQuery({
    queryKey: queryKeys.customers.primaryApplicants(),
    queryFn: () => listPrimaryApplicants(),
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
