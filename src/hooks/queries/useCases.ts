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
import { ensureLodgement } from '../../api/lodgements'
import type { CaseInsert, CaseUpdate } from '../../types/models'
import type { CaseStage, LodgementType } from '../../types/domain'
import { useAuth } from '../useAuth'
import { queryKeys } from './keys'

/** 阶段 → 对应递交类型：切到这些阶段时自动确保该递交记录存在。 */
const STAGE_TO_LODGEMENT_TYPE: Partial<Record<CaseStage, LodgementType>> = {
  nomination_lodged: 'nomination',
  visa_lodged: 'visa',
}

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
    mutationFn: async (params: Omit<UpdateCaseStageParams, 'changedBy'>) => {
      const result = await updateCaseStage({ ...params, changedBy: user?.id ?? null })
      // 切到「提名递交/签证递交」→ 自动确保对应递交记录存在（卡片随即出现，递交日期走派生）。
      // 尽力而为：阶段更新是主操作，自动建档失败不应让其报错（否则重试会重复写阶段历史）。
      const type = STAGE_TO_LODGEMENT_TYPE[params.toStage]
      if (type) {
        try {
          await ensureLodgement(params.caseId, type)
        } catch {
          /* 忽略：用户仍可在递交区手动补 */
        }
      }
      return result
    },
    onSuccess: (_data, vars) => {
      invalidateCases(qc)
      qc.invalidateQueries({ queryKey: queryKeys.cases.stageHistory(vars.caseId) })
      // 递交记录可能被自动创建：刷新案件详情的递交区 + 递交进度表
      qc.invalidateQueries({ queryKey: queryKeys.lodgements.byCase(vars.caseId) })
      qc.invalidateQueries({ queryKey: queryKeys.lodgements.lodged })
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
