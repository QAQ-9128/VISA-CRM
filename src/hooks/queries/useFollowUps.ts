import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createFollowUp,
  deleteFollowUp,
  listFollowUpsByCase,
  listFollowUpsByCustomer,
} from '../../api/followUps'
import type { FollowUpInsert } from '../../api/followUps'
import { useAuth } from '../useAuth'
import { queryKeys } from './keys'

export function useFollowUpsByCustomer(customerId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.followUps.byCustomer(customerId ?? ''),
    queryFn: () => listFollowUpsByCustomer(customerId as string),
    enabled: !!customerId,
  })
}

export function useFollowUpsByCase(caseId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.followUps.byCase(caseId ?? ''),
    queryFn: () => listFollowUpsByCase(caseId as string),
    enabled: !!caseId,
  })
}

export function useCreateFollowUp() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: (input: FollowUpInsert) => createFollowUp({ ...input, created_by: user?.id ?? null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.followUps.all }),
  })
}

export function useDeleteFollowUp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteFollowUp(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.followUps.all }),
  })
}
