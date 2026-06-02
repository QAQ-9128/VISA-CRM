import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createChecklistItem,
  deleteChecklistItem,
  listChecklist,
  setChecklistDone,
} from '../../api/checklist'
import type { ChecklistItem } from '../../types/models'
import { queryKeys } from './keys'

export function useChecklist() {
  return useQuery({ queryKey: queryKeys.checklist.all, queryFn: listChecklist })
}

interface AddChecklistVars {
  content: string
  customerId?: string | null
  caseId?: string | null
}

/**
 * 新增待办：乐观更新——点添加立即把该条插入 ['checklist'] 缓存（带客户/案件归属），
 * 失败回滚、成功后 onSettled 重拉真实数据替换临时项。解决「加完不刷新」。
 */
export function useAddChecklistItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ content, customerId = null, caseId = null }: AddChecklistVars) =>
      createChecklistItem(content, { customer_id: customerId, case_id: caseId }),
    onMutate: async ({ content, customerId = null, caseId = null }: AddChecklistVars) => {
      await qc.cancelQueries({ queryKey: queryKeys.checklist.all })
      const prev = qc.getQueryData<ChecklistItem[]>(queryKeys.checklist.all)
      const now = new Date().toISOString()
      const temp: ChecklistItem = {
        id: `optimistic-${Math.random().toString(36).slice(2)}`,
        content,
        is_done: false,
        customer_id: customerId,
        case_id: caseId,
        created_at: now,
        updated_at: now,
      }
      qc.setQueryData<ChecklistItem[]>(queryKeys.checklist.all, (old) => [...(old ?? []), temp])
      return { prev }
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.checklist.all, ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.checklist.all }),
  })
}

export function useToggleChecklistItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, is_done }: { id: string; is_done: boolean }) => setChecklistDone(id, is_done),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.checklist.all }),
  })
}

export function useDeleteChecklistItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteChecklistItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.checklist.all }),
  })
}
