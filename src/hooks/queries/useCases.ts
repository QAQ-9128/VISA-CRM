import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  archiveCase,
  createCase,
  deleteStageHistory,
  getCase,
  getCaseStageHistory,
  listAllStageHistory,
  listCases,
  listCasesByCustomer,
  updateCase,
  updateCaseStage,
  updateStageHistory,
} from '../../api/cases'
import type { CaseStageHistoryUpdate, UpdateCaseStageParams } from '../../api/cases'
import type { CaseInsert, CaseUpdate } from '../../types/models'
import { useAuth } from '../useAuth'
import { queryKeys } from './keys'

export function useCases() {
  return useQuery({ queryKey: queryKeys.cases.list, queryFn: () => listCases() })
}

export function useCasesByCustomer(customerId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.cases.byCustomer(customerId ?? ''),
    queryFn: () => listCasesByCustomer(customerId as string),
    enabled: !!customerId,
  })
}

export function useCase(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.cases.detail(id ?? ''),
    queryFn: () => getCase(id as string),
    enabled: !!id,
  })
}

export function useCaseStageHistory(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.cases.stageHistory(id ?? ''),
    queryFn: () => getCaseStageHistory(id as string),
    enabled: !!id,
  })
}

/** 全部阶段历史（递交进度表冻结距今用）。 */
export function useAllStageHistory() {
  return useQuery({ queryKey: queryKeys.cases.stageHistoryAll, queryFn: listAllStageHistory })
}

/** 案件变更后同时失效实体键与 dashboard.activeCases（概览/财务/案件表随之同步）。 */
function invalidateCases(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: queryKeys.cases.all })
  qc.invalidateQueries({ queryKey: queryKeys.dashboard.activeCases })
}

export function useCreateCase() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: (input: CaseInsert) => createCase({ ...input, created_by: user?.id ?? null }),
    onSuccess: () => invalidateCases(qc),
  })
}

export function useUpdateCase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: CaseUpdate }) => updateCase(id, patch),
    onSuccess: () => invalidateCases(qc),
  })
}

export function useUpdateCaseStage() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: (params: Omit<UpdateCaseStageParams, 'changedBy'>) =>
      updateCaseStage({ ...params, changedBy: user?.id ?? null }),
    onSuccess: (_data, vars) => {
      invalidateCases(qc)
      qc.invalidateQueries({ queryKey: queryKeys.cases.stageHistory(vars.caseId) })
    },
  })
}

/** 改某条阶段历史（实际发生时间等）。失效该案件的时间线。 */
export function useUpdateStageHistory(caseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: CaseStageHistoryUpdate }) =>
      updateStageHistory(id, patch),
    // 失效该案件时间线 + 全部案件键（递交表冻结距今依赖决定日期，需随之刷新）
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.cases.stageHistory(caseId) })
      qc.invalidateQueries({ queryKey: queryKeys.cases.all })
    },
  })
}

/** 删除某条阶段历史（不影响当前阶段）。失效该案件时间线 + 全部案件键。 */
export function useDeleteStageHistory(caseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteStageHistory(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.cases.stageHistory(caseId) })
      qc.invalidateQueries({ queryKey: queryKeys.cases.all })
    },
  })
}

export function useArchiveCase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => archiveCase(id),
    onSuccess: () => invalidateCases(qc),
  })
}
