import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createImmiAccount, getImmiAccount, listImmiAccounts } from '../../api/immiAccounts'
import type { ImmiAccountInsert } from '../../types/models'
import { useAuth } from '../useAuth'
import { queryKeys } from './keys'

/** 移民局系统账号 lookup（案件「所属账号」下拉用）。 */
export function useImmiAccounts() {
  return useQuery({ queryKey: queryKeys.immiAccounts.list, queryFn: () => listImmiAccounts() })
}

/** 解析单个账号（案件详情显示「所属账号」名字）。 */
export function useImmiAccount(id: string | undefined | null) {
  return useQuery({
    queryKey: queryKeys.immiAccounts.detail(id ?? ''),
    queryFn: () => getImmiAccount(id as string),
    enabled: !!id,
  })
}

export function useCreateImmiAccount() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: (input: ImmiAccountInsert) => createImmiAccount({ ...input, created_by: user?.id ?? null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.immiAccounts.all }),
    meta: { success: '账号已创建', errorPrefix: '创建账号失败' },
  })
}
