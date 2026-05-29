import { useQuery } from '@tanstack/react-query'
import { listProfiles } from '../../api/profiles'
import { queryKeys } from './keys'

/** 全部用户档案（id → 用户名）。用户极少变动，缓存较久。 */
export function useProfiles() {
  return useQuery({
    queryKey: queryKeys.profiles.list,
    queryFn: listProfiles,
    staleTime: 5 * 60_000,
  })
}
