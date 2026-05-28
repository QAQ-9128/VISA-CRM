import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listAllCaseApplicants,
  listCaseApplicants,
  setCaseApplicants,
} from '../../api/caseApplicants'
import { queryKeys } from './keys'

/** 某案件的副申请人关联（案件表单回填用）。 */
export function useCaseApplicants(caseId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.caseApplicants.byCase(caseId ?? ''),
    queryFn: () => listCaseApplicants(caseId as string),
    enabled: !!caseId,
  })
}

/** 全部案件申请人关联（案件表 / 财务页拼装用）。 */
export function useAllCaseApplicants() {
  return useQuery({ queryKey: queryKeys.caseApplicants.all, queryFn: listAllCaseApplicants })
}

export function useSetCaseApplicants() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ caseId, customerIds }: { caseId: string; customerIds: string[] }) =>
      setCaseApplicants(caseId, customerIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.caseApplicants.all }),
  })
}
