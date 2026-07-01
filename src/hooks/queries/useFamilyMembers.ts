import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createFamilyMember,
  deleteFamilyMember,
  listFamilyMembers,
  updateFamilyMember,
} from '../../api/familyMembers'
import type { CustomerFamilyMemberInsert, CustomerFamilyMemberUpdate } from '../../types/models'
import { queryKeys } from './keys'

/** 客户级 family（家庭成员）查询/变更（镜像 useReminders；不进账目）。 */
export function useFamilyMembers() {
  return useQuery({ queryKey: queryKeys.familyMembers.all, queryFn: listFamilyMembers })
}

export function useCreateFamilyMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CustomerFamilyMemberInsert) => createFamilyMember(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.familyMembers.all }),
    meta: { success: '已添加家庭成员', errorPrefix: '添加家庭成员失败' },
  })
}

export function useUpdateFamilyMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: CustomerFamilyMemberUpdate }) => updateFamilyMember(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.familyMembers.all }),
    meta: { success: '已更新家庭成员', errorPrefix: '更新家庭成员失败' },
  })
}

export function useDeleteFamilyMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteFamilyMember(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.familyMembers.all }),
    meta: { success: '已删除家庭成员', errorPrefix: '删除家庭成员失败' },
  })
}
