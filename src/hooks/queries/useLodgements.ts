import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createLodgement,
  listByCase,
  listLodged,
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

/** 全部「已递交」记录，供 /cases 递交总表用。 */
export function useLodgedLodgements() {
  return useQuery({ queryKey: queryKeys.lodgements.lodged, queryFn: listLodged })
}

export function useCreateLodgement(caseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: LodgementInsert) => createLodgement(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.lodgements.byCase(caseId) })
      qc.invalidateQueries({ queryKey: queryKeys.lodgements.lodged }) // 递交总表同步刷新
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
      qc.invalidateQueries({ queryKey: queryKeys.lodgements.lodged }) // 递交总表同步刷新
      qc.invalidateQueries({ queryKey: queryKeys.cases.all })
    },
  })
}
