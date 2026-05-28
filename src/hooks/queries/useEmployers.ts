import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  archiveEmployer,
  createEmployer,
  getEmployer,
  listEmployers,
  updateEmployer,
} from '../../api/employers'
import type { EmployerInsert, EmployerUpdate } from '../../api/employers'
import { useAuth } from '../useAuth'
import { queryKeys } from './keys'

export function useEmployers() {
  return useQuery({ queryKey: queryKeys.employers.list, queryFn: () => listEmployers() })
}

export function useEmployer(id: string | undefined | null) {
  return useQuery({
    queryKey: queryKeys.employers.detail(id ?? ''),
    queryFn: () => getEmployer(id as string),
    enabled: !!id,
  })
}

export function useCreateEmployer() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: (input: EmployerInsert) => createEmployer({ ...input, created_by: user?.id ?? null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.employers.all }),
  })
}

export function useUpdateEmployer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: EmployerUpdate }) => updateEmployer(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.employers.all }),
  })
}

export function useArchiveEmployer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => archiveEmployer(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.employers.all }),
  })
}
