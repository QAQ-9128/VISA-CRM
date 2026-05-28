import { supabase } from '../lib/supabase'
import type { Employer } from '../types/models'
import type { TablesInsert, TablesUpdate } from '../types/database'

export type EmployerInsert = TablesInsert<'employers'>
export type EmployerUpdate = TablesUpdate<'employers'>

/** 担保雇主列表，默认排除归档，按名称排序。 */
export async function listEmployers(opts: { includeArchived?: boolean } = {}): Promise<Employer[]> {
  let query = supabase.from('employers').select('*')
  if (!opts.includeArchived) query = query.eq('is_archived', false)
  query = query.order('name', { ascending: true })
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getEmployer(id: string): Promise<Employer | null> {
  const { data, error } = await supabase.from('employers').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function createEmployer(input: EmployerInsert): Promise<Employer> {
  const { data, error } = await supabase.from('employers').insert(input).select().single()
  if (error) throw error
  return data
}

export async function updateEmployer(id: string, patch: EmployerUpdate): Promise<Employer> {
  const { data, error } = await supabase
    .from('employers')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/** 归档 = 软删除。雇主与客户是一对多，归档不影响已挂靠的客户记录。 */
export async function archiveEmployer(id: string): Promise<void> {
  const { error } = await supabase.from('employers').update({ is_archived: true }).eq('id', id)
  if (error) throw error
}
