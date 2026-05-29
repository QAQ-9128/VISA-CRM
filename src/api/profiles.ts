import { supabase } from '../lib/supabase'
import type { Profile } from '../types/models'

/** 全部用户档案（profiles 全员可读，见 0001 RLS）。用于把 created_by 等 id 解析成用户名。 */
export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('*')
  if (error) throw error
  return data ?? []
}
