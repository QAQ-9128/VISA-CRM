import { supabase } from '../lib/supabase'
import type { CaseReminder } from '../types/models'
import type { TablesInsert, TablesUpdate } from '../types/database'

export type CaseReminderInsert = TablesInsert<'case_reminders'>
export type CaseReminderUpdate = TablesUpdate<'case_reminders'>

/** 全部案件提醒（日历紫点用，前端按月推算到期日）。 */
export async function listReminders(): Promise<CaseReminder[]> {
  const { data, error } = await supabase
    .from('case_reminders')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createReminder(input: CaseReminderInsert): Promise<CaseReminder> {
  const { data, error } = await supabase.from('case_reminders').insert(input).select().single()
  if (error) throw error
  return data
}

export async function updateReminder(id: string, patch: CaseReminderUpdate): Promise<CaseReminder> {
  const { data, error } = await supabase.from('case_reminders').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

/** 真删（RLS authed 全开）。命中 0 行显式报错（与 deletePayment 同口径）。 */
export async function deleteReminder(id: string): Promise<void> {
  const { data, error } = await supabase.from('case_reminders').delete().eq('id', id).select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('删除失败：该提醒不存在或已被删除')
}
