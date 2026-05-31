import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  archiveReferrer,
  createReferrer,
  deleteReferrer,
  getReferrer,
  listReferrers,
  updateReferrer,
} from '../../api/referrers'
import type { ReferrerInsert, ReferrerUpdate } from '../../api/referrers'
import { useAuth } from '../useAuth'
import { queryKeys } from './keys'

export function useReferrers() {
  return useQuery({ queryKey: queryKeys.referrers.list, queryFn: () => listReferrers() })
}

export function useReferrer(id: string | undefined | null) {
  return useQuery({
    queryKey: queryKeys.referrers.detail(id ?? ''),
    queryFn: () => getReferrer(id as string),
    enabled: !!id,
  })
}

export function useCreateReferrer() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: (input: ReferrerInsert) => createReferrer({ ...input, created_by: user?.id ?? null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.referrers.all }),
  })
}

export function useUpdateReferrer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ReferrerUpdate }) => updateReferrer(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.referrers.all }),
  })
}

export function useArchiveReferrer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => archiveReferrer(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.referrers.all }),
  })
}

/** 彻底删除介绍人（硬删）。已挂靠客户的 referrer_id 被置空 → 同时失效客户/概览缓存。 */
export function useDeleteReferrer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteReferrer(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.referrers.all })
      qc.invalidateQueries({ queryKey: queryKeys.customers.all })
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.activeCustomers })
    },
  })
}
