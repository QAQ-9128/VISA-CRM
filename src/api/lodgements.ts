import { supabase } from '../lib/supabase'
import type { Lodgement } from '../types/models'
import type { LodgementType } from '../types/domain'
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

/**
 * 全部递交记录，用于 /cases 递交总表（DHA 处理天数等）。
 * 注：递交日期已改为从 case_stage_history 派生，不再按 lodged_date 过滤（也不再读取该列）。
 */
export async function listAllLodgements(): Promise<Lodgement[]> {
  const { data, error } = await supabase.from('lodgements').select('*')
  if (error) throw error
  return data ?? []
}

/**
 * 确保某案件存在对应类型的递交记录（更新阶段到「提名递交/签证递交」时自动建）。
 * 按 (case_id, type) 唯一约束 upsert + ignoreDuplicates：缺则建一条空行（递交日期走派生，
 * 这里不写 lodged_date），已存在则不动其 DHA/参考号等已填字段。
 */
export async function ensureLodgement(caseId: string, type: LodgementType): Promise<void> {
  const { error } = await supabase
    .from('lodgements')
    .upsert({ case_id: caseId, type }, { onConflict: 'case_id,type', ignoreDuplicates: true })
  if (error) throw error
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
