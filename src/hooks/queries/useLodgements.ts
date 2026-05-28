import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createLodgement,
  listByCase,
  updateLodgement,
} from '../../api/lodgements'
import type { LodgementInsert, LodgementUpdate } from '../../api/lodgements'
import { queryKeys } from './keys'

export function useLodgements(caseId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.lodgements.byCase(caseId ?? ''),
    queryFn: () => listByCase(caseId as string),
    enabled: !!caseId,
  })
}

export function useCreateLodgement(caseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: LodgementInsert) => createLodgement(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.lodgements.byCase(caseId) })
      qc.invalidateQueries({ queryKey: queryKeys.cases.all })
    },
  })
}

export function useUpdateLodgement(caseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: LodgementUpdate }) =>
      updateLodgement(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.lodgements.byCase(caseId) })
      qc.invalidateQueries({ queryKey: queryKeys.cases.all })
    },
  })
}
