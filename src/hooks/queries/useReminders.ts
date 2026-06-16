import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createReminder, deleteReminder, listReminders, updateReminder } from '../../api/reminders'
import type { CaseReminderInsert, CaseReminderUpdate } from '../../api/reminders'
import { useAuth } from '../useAuth'
import { queryKeys } from './keys'

export function useReminders() {
  return useQuery({ queryKey: queryKeys.reminders.all, queryFn: listReminders })
}

export function useCreateReminder() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: (input: CaseReminderInsert) => createReminder({ ...input, created_by: user?.id ?? null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.reminders.all }),
    meta: { success: '提醒已添加', errorPrefix: '添加提醒失败' },
  })
}

export function useUpdateReminder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: CaseReminderUpdate }) => updateReminder(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.reminders.all }),
    meta: { success: '提醒已更新', errorPrefix: '更新提醒失败' },
  })
}

export function useDeleteReminder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteReminder(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.reminders.all }),
    meta: { success: '提醒已删除', errorPrefix: '删除提醒失败' },
  })
}
