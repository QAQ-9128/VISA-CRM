import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createLodgement,
  listAllLodgements,
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

/** 全部递交记录，供 /cases 递交总表用（递交日期已改为派生，这里只为 DHA 等字段）。 */
export function useAllLodgements() {
  return useQuery({ queryKey: queryKeys.lodgements.lodged, queryFn: listAllLodgements })
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
    meta: { success: '递交记录已添加', errorPrefix: '添加递交记录失败' },
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
    meta: { success: '递交记录已保存', errorPrefix: '保存递交记录失败' },
  })
}
