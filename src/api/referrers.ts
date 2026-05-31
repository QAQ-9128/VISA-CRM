import { supabase } from '../lib/supabase'
import type { Referrer } from '../types/models'
import type { TablesInsert, TablesUpdate } from '../types/database'

export type ReferrerInsert = TablesInsert<'referrers'>
export type ReferrerUpdate = TablesUpdate<'referrers'>

/** 介绍人列表，默认排除归档，按名称排序。 */
export async function listReferrers(opts: { includeArchived?: boolean } = {}): Promise<Referrer[]> {
  let query = supabase.from('referrers').select('*')
  if (!opts.includeArchived) query = query.eq('is_archived', false)
  query = query.order('name', { ascending: true })
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getReferrer(id: string): Promise<Referrer | null> {
  const { data, error } = await supabase.from('referrers').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function createReferrer(input: ReferrerInsert): Promise<Referrer> {
  const { data, error } = await supabase.from('referrers').insert(input).select().single()
  if (error) throw error
  return data
}

export async function updateReferrer(id: string, patch: ReferrerUpdate): Promise<Referrer> {
  const { data, error } = await supabase
    .from('referrers')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/** 归档 = 软删除。介绍人与客户是一对多，归档不影响已挂靠的客户记录。 */
export async function archiveReferrer(id: string): Promise<void> {
  const { error } = await supabase.from('referrers').update({ is_archived: true }).eq('id', id)
  if (error) throw error
}

/** 彻底删除（硬删，不可恢复）：真 DELETE。已挂靠客户的 referrer_id 会被置空。RLS 仅 admin。 */
export async function deleteReferrer(id: string): Promise<void> {
  const { error } = await supabase.from('referrers').delete().eq('id', id)
  if (error) throw error
}
