import { supabase } from '../lib/supabase'
import type { RecordRow, RecordInsert, RecordUpdate } from '../types/models'

/** 某客户的全部记录（待办 + 跟进同表）。排序在前端 sortRecords 处理。 */
export async function listRecordsByCustomer(customerId: string): Promise<RecordRow[]> {
  const { data, error } = await supabase.from('records').select('*').eq('customer_id', customerId)
  if (error) throw error
  return data ?? []
}

export async function listRecordsByCase(caseId: string): Promise<RecordRow[]> {
  const { data, error } = await supabase.from('records').select('*').eq('case_id', caseId)
  if (error) throw error
  return data ?? []
}

/**
 * 全部未完成记录（待办 + 跟进同表，不按类型过滤）。
 * 递交进度表「待办」列用：跟进(带表情符号)也要出现，故只筛 is_done=false。
 */
export async function getOpenRecords(): Promise<RecordRow[]> {
  const { data, error } = await supabase.from('records').select('*').eq('is_done', false)
  if (error) throw error
  return data ?? []
}

export async function createRecord(input: RecordInsert): Promise<RecordRow> {
  const { data, error } = await supabase.from('records').insert(input).select().single()
  if (error) throw error
  return data
}

/** 编辑现有记录（含类型切换 type='task'|'follow_up'）：按 id UPDATE，绝不 INSERT。 */
export async function updateRecord(id: string, patch: RecordUpdate): Promise<RecordRow> {
  const { data, error } = await supabase.from('records').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteRecord(id: string): Promise<void> {
  const { error } = await supabase.from('records').delete().eq('id', id)
  if (error) throw error
}
