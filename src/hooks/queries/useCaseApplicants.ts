import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addCaseApplicant,
  listAllCaseApplicants,
  listCaseApplicants,
  setCaseApplicants,
} from '../../api/caseApplicants'
import { queryKeys } from './keys'

/** 某案件的参与人关联（参与人 = 案件客户 + 本表成员；案件表单回填/详情/费用卡用）。 */
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

/** 把客户加入某案件（增量单条；新建客户「加入已有案件」用）。失效 caseApplicants 前缀 → 全站参与人视图同步。 */
export function useAddCaseApplicant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ caseId, customerId }: { caseId: string; customerId: string }) =>
      addCaseApplicant(caseId, customerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.caseApplicants.all }),
  })
}
