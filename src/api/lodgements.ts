import { supabase } from '../lib/supabase'
import type { Lodgement } from '../types/models'
import type { TablesInsert, TablesUpdate } from '../types/database'

export type LodgementInsert = TablesInsert<'lodgements'>
export type LodgementUpdate = TablesUpdate<'lodgements'>

/** 某案件的递交记录（最多 nomination + visa 两条，由 schema unique 约束保证）。 */
export async function listByCase(caseId: string): Promise<Lodgement[]> {
  const { data, error } = await supabase
    .from('lodgements')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

/** 全部「已递交」的递交记录（lodged_date 非空），用于 /cases 递交总表。 */
export async function listLodged(): Promise<Lodgement[]> {
  const { data, error } = await supabase
    .from('lodgements')
    .select('*')
    .not('lodged_date', 'is', null)
  if (error) throw error
  return data ?? []
}

export async function createLodgement(input: LodgementInsert): Promise<Lodgement> {
  const { data, error } = await supabase.from('lodgements').insert(input).select().single()
  if (error) throw error
  return data
}

export async function updateLodgement(id: string, patch: LodgementUpdate): Promise<Lodgement> {
  const { data, error } = await supabase
    .from('lodgements')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}
