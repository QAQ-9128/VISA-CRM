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

/** 引用该账号的案件数（删除前提示「X 个案件在用」；含归档案件，与置空范围一致）。 */
export async function countCasesUsingImmiAccount(id: string): Promise<number> {
  const { count, error } = await supabase
    .from('cases')
    .select('id', { count: 'exact', head: true })
    .eq('immi_account_id', id)
  if (error) throw error
  return count ?? 0
}

/**
 * 删除账号：① 把引用它的案件「所属账号」置空（未指定）；② 归档账号本身（从下拉/管理列表移除）。
 * 两步都是 UPDATE（RLS=authenticated，staff 可用）；不做硬删（硬删 RLS=admin）。
 * 对用户等同删除：账号消失，原引用案件显示「未指定」。
 */
export async function deleteImmiAccount(id: string): Promise<void> {
  const { error: refErr } = await supabase.from('cases').update({ immi_account_id: null }).eq('immi_account_id', id)
  if (refErr) throw refErr
  const { error } = await supabase.from('immi_accounts').update({ is_archived: true }).eq('id', id)
  if (error) throw error
}
