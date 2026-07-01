import { supabase } from '../lib/supabase'
import type { CustomerFamilyMember, CustomerFamilyMemberInsert, CustomerFamilyMemberUpdate } from '../types/models'

/** 客户级 family（家庭成员）薄封装（不进账目、纯关系信息）。镜像 api/reminders.ts 口径。 */

/** 全部 family 成员（前端按 customer_id 过滤到当前客户）。 */
export async function listFamilyMembers(): Promise<CustomerFamilyMember[]> {
  const { data, error } = await supabase
    .from('customer_family_members')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createFamilyMember(input: CustomerFamilyMemberInsert): Promise<CustomerFamilyMember> {
  const { data, error } = await supabase.from('customer_family_members').insert(input).select().single()
  if (error) throw error
  return data
}

export async function updateFamilyMember(id: string, patch: CustomerFamilyMemberUpdate): Promise<CustomerFamilyMember> {
  const { data, error } = await supabase.from('customer_family_members').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

/** 真删（RLS authed 全开）。命中 0 行显式报错（与 deleteReminder 同口径）。 */
export async function deleteFamilyMember(id: string): Promise<void> {
  const { data, error } = await supabase.from('customer_family_members').delete().eq('id', id).select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('删除失败：该成员不存在或已被删除')
}
