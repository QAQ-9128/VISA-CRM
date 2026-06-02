import { supabase } from '../lib/supabase'
import type { ChecklistItem } from '../types/models'

/** 概览待办清单：一句话 + 勾选框，可选关联客户/案件。按 created_at 升序（先记的在上）。 */
export async function listChecklist(): Promise<ChecklistItem[]> {
  const { data, error } = await supabase
    .from('checklist_items')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

/** 新增清单项；link 可选挂客户/案件（不传即纯文字随手记，行为同旧版）。 */
export async function createChecklistItem(
  content: string,
  link: { customer_id?: string | null; case_id?: string | null } = {},
): Promise<ChecklistItem> {
  const insert: { content: string; customer_id?: string | null; case_id?: string | null } = { content }
  if (link.customer_id !== undefined) insert.customer_id = link.customer_id
  if (link.case_id !== undefined) insert.case_id = link.case_id
  const { data, error } = await supabase.from('checklist_items').insert(insert).select().single()
  if (error) throw error
  return data
}

export async function setChecklistDone(id: string, is_done: boolean): Promise<void> {
  const { error } = await supabase.from('checklist_items').update({ is_done }).eq('id', id)
  if (error) throw error
}

export async function deleteChecklistItem(id: string): Promise<void> {
  const { error } = await supabase.from('checklist_items').delete().eq('id', id)
  if (error) throw error
}
