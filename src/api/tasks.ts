import { supabase } from '../lib/supabase'
import type { Task } from '../types/models'
import type { TablesInsert, TablesUpdate } from '../types/database'

export type TaskInsert = TablesInsert<'tasks'>
export type TaskUpdate = TablesUpdate<'tasks'>

// 待办列表：未完成在前，再按截止日升序。
export async function listTasksByCustomer(customerId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('customer_id', customerId)
    .order('is_done', { ascending: true })
    .order('due_date', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data ?? []
}

export async function listTasksByCase(caseId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('case_id', caseId)
    .order('is_done', { ascending: true })
    .order('due_date', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data ?? []
}

export async function createTask(input: TaskInsert): Promise<Task> {
  const { data, error } = await supabase.from('tasks').insert(input).select().single()
  if (error) throw error
  return data
}

export async function updateTask(id: string, patch: TaskUpdate): Promise<Task> {
  const { data, error } = await supabase.from('tasks').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw error
}

/** 全部未完成任务（Dashboard「我的待办」候选，前端再按归属/临近过滤）。 */
export async function getOpenTasks(): Promise<Task[]> {
  const { data, error } = await supabase.from('tasks').select('*').eq('is_done', false)
  if (error) throw error
  return data ?? []
}
