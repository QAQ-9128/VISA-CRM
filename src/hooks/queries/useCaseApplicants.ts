import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addCaseApplicant,
  listAllCaseApplicants,
  listCaseApplicants,
  removeCaseApplicant,
  removeSelfFromCase,
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

/** 覆盖式整组写入：仅供**新建案件**保存后写一次表单里选好的参与人（编辑模式禁用——会覆盖清空）。 */
export function useSetCaseApplicants() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ caseId, customerIds }: { caseId: string; customerIds: string[] }) =>
      setCaseApplicants(caseId, customerIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.caseApplicants.all }),
  })
}

/**
 * 把自己移出本案（任何参与人、仅能移自己）。案件客户移出 = 案件过户给其余参与人
 * → 案件归属/链接会变，连带失效案件缓存。账目数据原样保留，可被重新添加。
 */
export function useRemoveSelfFromCase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ caseId, customerId }: { caseId: string; customerId: string }) =>
      removeSelfFromCase(caseId, customerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.caseApplicants.all })
      qc.invalidateQueries({ queryKey: queryKeys.cases.all })
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.activeCases })
    },
    meta: { success: '已退出本案', errorPrefix: '退出失败' },
  })
}

/** 把客户加入某案件（增量单条；新建客户「加入已有案件」/相关案件卡「+ 添加参与人」用）。失效 caseApplicants 前缀 → 全站参与人视图同步。 */
export function useAddCaseApplicant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ caseId, customerId }: { caseId: string; customerId: string }) =>
      addCaseApplicant(caseId, customerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.caseApplicants.all }),
    meta: { success: '已加入案件', errorPrefix: '加入案件失败' },
  })
}

/**
 * 移除某案件的指定成员（增量单条；编辑案件表单「组」里删减成员用）。
 * 仅删该成员的 case_applicants 行，**不动案件客户(cases.customer_id)**——移出案件客户=过户，另走 useRemoveSelfFromCase。
 * 失效 caseApplicants 前缀（连带 byCase 列表）+ cases/dashboard，让全站参与人/组码视图同步。
 */
export function useRemoveCaseApplicant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ caseId, customerId }: { caseId: string; customerId: string }) =>
      removeCaseApplicant(caseId, customerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.caseApplicants.all })
      qc.invalidateQueries({ queryKey: queryKeys.cases.all })
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.activeCases })
    },
    meta: { success: '已移出参与人', errorPrefix: '移出失败' },
  })
}
