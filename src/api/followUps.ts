import { supabase } from '../lib/supabase'
import type { FollowUp } from '../types/models'
import type { TablesInsert } from '../types/database'

export type FollowUpInsert = TablesInsert<'follow_ups'>

export async function listFollowUpsByCustomer(customerId: string): Promise<FollowUp[]> {
  const { data, error } = await supabase
    .from('follow_ups')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function listFollowUpsByCase(caseId: string): Promise<FollowUp[]> {
  const { data, error } = await supabase
    .from('follow_ups')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createFollowUp(input: FollowUpInsert): Promise<FollowUp> {
  const { data, error } = await supabase.from('follow_ups').insert(input).select().single()
  if (error) throw error
  return data
}

export async function deleteFollowUp(id: string): Promise<void> {
  const { error } = await supabase.from('follow_ups').delete().eq('id', id)
  if (error) throw error
}
