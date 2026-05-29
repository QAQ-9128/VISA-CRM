import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createTask,
  deleteTask,
  getOpenTasks,
  listTasksByCase,
  listTasksByCustomer,
  updateTask,
} from '../../api/tasks'
import type { TaskInsert, TaskUpdate } from '../../api/tasks'
import { useAuth } from '../useAuth'
import { queryKeys } from './keys'

export function useTasksByCustomer(customerId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.tasks.byCustomer(customerId ?? ''),
    queryFn: () => listTasksByCustomer(customerId as string),
    enabled: !!customerId,
  })
}

export function useTasksByCase(caseId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.tasks.byCase(caseId ?? ''),
    queryFn: () => listTasksByCase(caseId as string),
    enabled: !!caseId,
  })
}

/** 全部未完成待办（全部案件列表用，前端按 case_id 分组取各案件最新数条）。 */
export function useOpenTasks() {
  return useQuery({ queryKey: queryKeys.tasks.open, queryFn: getOpenTasks })
}

export function useCreateTask() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    // assigned_to 默认当前用户（可由 input 覆盖）；created_by 记当前用户
    mutationFn: (input: TaskInsert) =>
      createTask({
        assigned_to: user?.id ?? null,
        ...input,
        created_by: user?.id ?? null,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tasks.all }),
  })
}

export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TaskUpdate }) => updateTask(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tasks.all }),
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tasks.all }),
  })
}
