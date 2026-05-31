import { supabase } from '../lib/supabase'
import type { ChecklistItem } from '../types/models'

/** 概览独立待办清单（不关联客户/案件）：一句话 + 勾选框。按 created_at 升序（先记的在上）。 */
export async function listChecklist(): Promise<ChecklistItem[]> {
  const { data, error } = await supabase
    .from('checklist_items')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createChecklistItem(content: string): Promise<ChecklistItem> {
  const { data, error } = await supabase
    .from('checklist_items')
    .insert({ content })
    .select()
    .single()
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
