import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  archiveCase,
  createCase,
  deleteCase,
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
import { todayYmd } from '../../lib/dateRules'
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
    meta: { success: '案件已创建', errorPrefix: '创建案件失败' },
  })
}

export function useUpdateCase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: CaseUpdate }) => updateCase(id, patch),
    onSuccess: () => invalidateCases(qc),
    meta: { success: '案件已保存', errorPrefix: '保存案件失败' },
  })
}

/**
 * 「不再提醒」：手动停止某案的 482→186 TRT 提醒（置 trt_reminder_dismissed=true）。
 * 复用 updateCase + invalidateCases —— 失效案件键 + dashboard.activeCases，客户页绿卡与概览
 * 临近到期条随之消失（提醒派生于这两处的案件数据）。
 */
export function useDismissTrtReminder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => updateCase(id, { trt_reminder_dismissed: true }),
    onSuccess: () => invalidateCases(qc),
    meta: { success: '已停止该案的 186 TRT 提醒', errorPrefix: '操作失败' },
  })
}

/**
 * 「本次已更新」：同居材料已收集，把周期锚点顺延到今天（cohab_reminder_last），
 * 下一个 3 个月周期到点再次提醒（lib/cohab 派生）。失效口径同 TRT 提醒。
 */
export function useMarkCohabUpdated() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => updateCase(id, { cohab_reminder_last: todayYmd() }),
    onSuccess: () => invalidateCases(qc),
    meta: { success: '已记录本次更新，3 个月后再次提醒', errorPrefix: '操作失败' },
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
    meta: { success: '阶段已更新', errorPrefix: '更新阶段失败' },
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
    meta: { success: '流转记录已修改', errorPrefix: '修改失败' },
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
    meta: { success: '流转记录已删除', errorPrefix: '删除失败' },
  })
}

export function useArchiveCase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => archiveCase(id),
    onSuccess: () => invalidateCases(qc),
    meta: { success: '案件已归档，所有参与人处一并隐藏（档案库→回收站 可恢复）', errorPrefix: '归档失败' },
  })
}

/** 彻底删除案件（硬删，级联删递交/阶段历史/账目等）。影响面广，成功后失效全部查询缓存。
 *  0031 起全员开放（两位用户均 staff，2026-06 拍板）。 */
export function useDeleteCase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCase(id),
    onSuccess: () => qc.invalidateQueries(),
    meta: { success: '案件已彻底删除', errorPrefix: '删除失败' },
  })
}
