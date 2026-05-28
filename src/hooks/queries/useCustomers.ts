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

export function useCreateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CustomerInsert) => createCustomer(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.customers.all }),
  })
}

export function useUpdateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: CustomerUpdate }) =>
      updateCustomer(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.customers.all }),
  })
}

export function useArchiveCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => archiveCustomer(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.customers.all }),
  })
}
