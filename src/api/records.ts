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

/** 全部未完成的待办记录（概览「我的待办 / 待办客户清单」候选）。 */
export async function getOpenTaskRecords(): Promise<RecordRow[]> {
  const { data, error } = await supabase
    .from('records')
    .select('*')
    .eq('type', 'task')
    .eq('is_done', false)
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
