import { supabase } from '../lib/supabase'
import type { ImmiAccount, ImmiAccountInsert } from '../types/models'

/**
 * 移民局系统账号（ImmiAccount）lookup：代理名下有数个递交账号（目前 3 个），
 * 建一次即可被多个案件复用（cases.immi_account_id 指向这里）。仅名称一个业务字段。
 */

/** 账号列表，默认排除归档，按名称排序。 */
export async function listImmiAccounts(opts: { includeArchived?: boolean } = {}): Promise<ImmiAccount[]> {
  let query = supabase.from('immi_accounts').select('*')
  if (!opts.includeArchived) query = query.eq('is_archived', false)
  query = query.order('name', { ascending: true })
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

/** 按 id 取单个账号（案件详情解析「所属账号」名字用）。 */
export async function getImmiAccount(id: string): Promise<ImmiAccount | null> {
  const { data, error } = await supabase.from('immi_accounts').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

/** 新建账号（案件表单「+ 新增」就地创建）。 */
export async function createImmiAccount(input: ImmiAccountInsert): Promise<ImmiAccount> {
  const { data, error } = await supabase.from('immi_accounts').insert(input).select().single()
  if (error) throw error
  return data
}
