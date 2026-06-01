import { supabase } from '../lib/supabase'
import type { Customer, CustomerInsert, CustomerUpdate } from '../types/models'

export interface ListCustomersOptions {
  /** 模糊搜索 full_name / phone / email */
  search?: string
  /** 是否包含已归档（默认不含） */
  includeArchived?: boolean
}

/** 客户列表：默认排除已归档，星标置顶，再按姓名排序。 */
export async function listCustomers(opts: ListCustomersOptions = {}): Promise<Customer[]> {
  let query = supabase.from('customers').select('*')

  if (!opts.includeArchived) {
    query = query.eq('is_archived', false)
  }

  const term = opts.search?.trim()
  if (term) {
    const like = `%${term}%`
    query = query.or(`full_name.ilike.${like},phone.ilike.${like},email.ilike.${like}`)
  }

  query = query
    .order('is_starred', { ascending: false })
    .order('full_name', { ascending: true })

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

/** 单个客户详情 */
export async function getCustomer(id: string): Promise<Customer | null> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

/** 某主申请人名下的副申请人（家庭组成员），未归档，按姓名排序。 */
export async function getSubApplicants(primaryId: string): Promise<Customer[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('primary_applicant_id', primaryId)
    .eq('is_archived', false)
    .order('full_name', { ascending: true })
  if (error) throw error
  return data ?? []
}

/** 可作为「主申请人」被挂靠的客户（primary_applicant_id 为空、未归档）。用于表单下拉。 */
export async function listPrimaryApplicants(): Promise<Customer[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .is('primary_applicant_id', null)
    .eq('is_archived', false)
    .order('full_name', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createCustomer(input: CustomerInsert): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data
}

export interface FamilyMemberInput {
  full_name: string
  gender: string | null
  birth_date: string | null
  relationship_to_primary: string | null
}

/**
 * 「一键添加家庭成员」：仅创建一个 primary_applicant_id 指向主申请的 customer 行，
 * 只写四个字段，其余留空（DB 默认 null）。绝不创建 case、不联动 sync、不触发 TRT。
 * 复用 createCustomer 的单一插入路径。
 */
export async function addFamilyMember(primaryId: string, input: FamilyMemberInput): Promise<Customer> {
  return createCustomer({
    full_name: input.full_name,
    gender: input.gender,
    birth_date: input.birth_date,
    relationship_to_primary: input.relationship_to_primary,
    primary_applicant_id: primaryId,
  })
}

export async function updateCustomer(id: string, patch: CustomerUpdate): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/** 归档 = 软删除（置 is_archived=true），不真删，保留数据与外键关系。 */
export async function archiveCustomer(id: string): Promise<void> {
  const { error } = await supabase
    .from('customers')
    .update({ is_archived: true })
    .eq('id', id)
  if (error) throw error
}

/**
 * 彻底删除（硬删，不可恢复）：真 DELETE。外键级联会连同其名下案件→递交/阶段历史/账目、
 * 文件、记录、待办等一并删除；其副申请人的 primary_applicant_id 置空。RLS 仅 admin 可执行。
 */
export async function deleteCustomer(id: string): Promise<void> {
  const { error } = await supabase.from('customers').delete().eq('id', id)
  if (error) throw error
}

export async function unarchiveCustomer(id: string): Promise<void> {
  const { error } = await supabase
    .from('customers')
    .update({ is_archived: false })
    .eq('id', id)
  if (error) throw error
}
