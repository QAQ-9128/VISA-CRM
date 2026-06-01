import { supabase } from '../lib/supabase'
import type { FamilyMemberLink, FamilyMemberLinkInsert } from '../types/models'

/** 全部家庭成员关联（客户列表/详情家庭区共用，前端按主申/成员派生）。 */
export async function listFamilyLinks(): Promise<FamilyMemberLink[]> {
  const { data, error } = await supabase.from('family_member_links').select('*')
  if (error) throw error
  return data ?? []
}

/** 把已有客户关联为某主申的副申（不改其 primary_applicant_id）。 */
export async function createFamilyLink(input: FamilyMemberLinkInsert): Promise<FamilyMemberLink> {
  const { data, error } = await supabase.from('family_member_links').insert(input).select().single()
  if (error) throw error
  return data
}

/** 移除关联（只删 link，不动两端客户）。RLS 仅 admin 可执行。 */
export async function deleteFamilyLink(id: string): Promise<void> {
  const { error } = await supabase.from('family_member_links').delete().eq('id', id)
  if (error) throw error
}
