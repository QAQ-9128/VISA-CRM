import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import {
  archiveReferrer,
  createReferrer,
  deleteReferrer,
  getReferrer,
  listReferrers,
  updateReferrer,
} from '../../api/referrers'
import type { ReferrerInsert, ReferrerUpdate } from '../../api/referrers'
import { useAuth } from '../useAuth'
import { queryKeys } from './keys'

export function useReferrers() {
  return useQuery({ queryKey: queryKeys.referrers.list, queryFn: () => listReferrers() })
}

export function useReferrer(id: string | undefined | null) {
  return useQuery({
    queryKey: queryKeys.referrers.detail(id ?? ''),
    queryFn: () => getReferrer(id as string),
    enabled: !!id,
  })
}

/**
 * 介绍人变更后：referrers 前缀 + finance.referrers（财务页/客户财务/概要带的介绍人名
 * 走 finance 命名空间的独立缓存键，前缀盖不到，需显式失效——改名/归档即处处同步）。
 */
function invalidateReferrers(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: queryKeys.referrers.all })
  qc.invalidateQueries({ queryKey: queryKeys.finance.referrers })
}

export function useCreateReferrer() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: (input: ReferrerInsert) => createReferrer({ ...input, created_by: user?.id ?? null }),
    onSuccess: () => invalidateReferrers(qc),
    meta: { success: '介绍人已创建', errorPrefix: '创建介绍人失败' },
  })
}

/** 创建归属人（referrers 一表两用，kind 固定 owner）；OwnerSelect 的「创建 "…"」行用。 */
export function useCreateOwner() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: (input: ReferrerInsert) =>
      createReferrer({ ...input, kind: 'owner', created_by: user?.id ?? null }),
    onSuccess: () => invalidateReferrers(qc),
    meta: { success: '归属人已创建', errorPrefix: '创建归属人失败' },
  })
}

export function useUpdateReferrer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ReferrerUpdate }) => updateReferrer(id, patch),
    onSuccess: () => invalidateReferrers(qc),
    meta: { success: '介绍人已保存', errorPrefix: '保存介绍人失败' },
  })
}

export function useArchiveReferrer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => archiveReferrer(id),
    onSuccess: () => invalidateReferrers(qc),
    meta: { success: '介绍人已归档', errorPrefix: '归档失败' },
  })
}

/** 彻底删除介绍人（硬删）。已挂靠客户的 referrer_id 被置空 → 同时失效客户/概览缓存。 */
export function useDeleteReferrer() {
  const qc = useQueryClient()
  const { isAdmin } = useAuth()
  return useMutation({
    // 纵深防御：彻底删除是 admin 专属（RLS 同样限制），入口拦下避免被静默挡掉无提示
    mutationFn: async (id: string) => {
      if (!isAdmin) throw new Error('仅管理员可彻底删除')
      await deleteReferrer(id)
    },
    onSuccess: () => {
      invalidateReferrers(qc)
      qc.invalidateQueries({ queryKey: queryKeys.customers.all })
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.activeCustomers })
    },
    meta: { success: '介绍人已彻底删除', errorPrefix: '删除失败' },
  })
}
