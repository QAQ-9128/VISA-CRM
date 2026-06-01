import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { createFamilyLink, deleteFamilyLink, listFamilyLinks } from '../../api/familyLinks'
import type { FamilyMemberLinkInsert } from '../../types/models'
import { queryKeys } from './keys'

/** 全部家庭成员关联（客户列表分组 + 详情家庭区共用同一份缓存）。 */
export function useFamilyLinks() {
  return useQuery({ queryKey: queryKeys.familyLinks.all, queryFn: listFamilyLinks })
}

function invalidateLinks(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: queryKeys.familyLinks.all })
  qc.invalidateQueries({ queryKey: queryKeys.customers.all })
}

/** 关联现有客户为 primaryId 的副申。 */
export function useCreateFamilyLink(primaryId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<FamilyMemberLinkInsert, 'primary_customer_id'>) =>
      createFamilyLink({ ...input, primary_customer_id: primaryId }),
    onSuccess: () => invalidateLinks(qc),
  })
}

export function useDeleteFamilyLink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteFamilyLink(id),
    onSuccess: () => invalidateLinks(qc),
  })
}
