import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  archiveReferrer,
  createReferrer,
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
