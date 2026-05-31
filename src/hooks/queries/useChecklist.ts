import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createChecklistItem,
  deleteChecklistItem,
  listChecklist,
  setChecklistDone,
} from '../../api/checklist'
import { queryKeys } from './keys'

export function useChecklist() {
  return useQuery({ queryKey: queryKeys.checklist.all, queryFn: listChecklist })
}

export function useAddChecklistItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (content: string) => createChecklistItem(content),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.checklist.all }),
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
