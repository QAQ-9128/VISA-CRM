import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  archiveCase,
  createCase,
  getCase,
  getCaseStageHistory,
  listCases,
  listCasesByCustomer,
  updateCase,
  updateCaseStage,
} from '../../api/cases'
import type { UpdateCaseStageParams } from '../../api/cases'
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

export function useArchiveCase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => archiveCase(id),
    onSuccess: () => invalidateCases(qc),
  })
}
