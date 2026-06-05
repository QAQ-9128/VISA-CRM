import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createRecord,
  deleteRecord,
  getOpenRecords,
  listRecordsByCase,
  listRecordsByCustomer,
  updateRecord,
} from '../../api/records'
import type { RecordInsert, RecordUpdate } from '../../types/models'
import { useAuth } from '../useAuth'
import { queryKeys } from './keys'

export function useRecordsByCustomer(customerId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.records.byCustomer(customerId ?? ''),
    queryFn: () => listRecordsByCustomer(customerId as string),
    enabled: !!customerId,
  })
}

export function useRecordsByCase(caseId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.records.byCase(caseId ?? ''),
    queryFn: () => listRecordsByCase(caseId as string),
    enabled: !!caseId,
  })
}

/** 全部未完成记录（待办 + 跟进，不限类型）——递交进度表「待办」列用。 */
export function useOpenRecords() {
  return useQuery({ queryKey: queryKeys.records.open, queryFn: getOpenRecords })
}

export function useCreateRecord() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    // created_by 记当前用户；待办默认 assigned_to 当前用户（驱动「我的待办」）
    mutationFn: (input: RecordInsert) =>
      createRecord({
        ...input,
        created_by: user?.id ?? null,
        assigned_to: input.type === 'task' ? input.assigned_to ?? user?.id ?? null : input.assigned_to ?? null,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.records.all }),
    meta: { success: '已添加', errorPrefix: '添加失败' },
  })
}

// useUpdateRecord 兼作「勾选完成」高频操作 → 成功保持安静，失败仍有全局红 toast
export function useUpdateRecord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: RecordUpdate }) => updateRecord(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.records.all }),
  })
}

export function useDeleteRecord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteRecord(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.records.all }),
    meta: { success: '已删除', errorPrefix: '删除失败' },
  })
}
