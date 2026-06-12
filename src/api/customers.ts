import { supabase } from '../lib/supabase'
import type { Customer, CustomerInsert, CustomerUpdate } from '../types/models'

export interface ListCustomersOptions {
  /** 模糊搜索 full_name / 中文名 / 英文名 / phone / email */
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
    // PostgREST 的 .or() 串里逗号/括号是语法保留字符：模式值必须双引号包裹，
    // 内部的 \ 与 " 转义，否则搜「Smith, John」「a(b」会破坏过滤语法（结果错误或 400）。
    const escaped = term.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    const like = `"%${escaped}%"`
    query = query.or(
      `full_name.ilike.${like},chinese_name.ilike.${like},english_name.ilike.${like},phone.ilike.${like},email.ilike.${like}`,
    )
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

/**
 * 归档 = 软删除（置 is_archived=true），不真删，保留数据与外键关系。
 * 案件连带规则（2026-06-05 用户最终拍板）：**TA 参与的所有案件一并归档**
 * （作为案件客户 ∪ 作为参与人，不区分单人/多人；回收站里客户与案件分别可恢复）。
 * 想保住某个案件 → 先在相关案件卡把 TA 移出参与人再归档。
 */
export async function archiveCustomer(id: string): Promise<void> {
  // ① TA 参与的全部案件（作为案件客户 ∪ 作为参与人）
  const owned = await supabase.from('cases').select('id').eq('customer_id', id).eq('is_archived', false)
  if (owned.error) throw owned.error
  const part = await supabase.from('case_applicants').select('case_id').eq('customer_id', id)
  if (part.error) throw part.error
  const caseIds = [...new Set([...(owned.data ?? []).map((c) => c.id), ...(part.data ?? []).map((a) => a.case_id)])]

  // ② 一把全归档
  if (caseIds.length > 0) {
    const up = await supabase.from('cases').update({ is_archived: true }).in('id', caseIds)
    if (up.error) throw up.error
  }

  // ③ 客户本体软删
  const { error } = await supabase
    .from('customers')
    .update({ is_archived: true })
    .eq('id', id)
  if (error) throw error
}

/**
 * 彻底删除客户（硬删，不可恢复）。2026-06-05 用户定版：删人不删多人案件——
 *  1) TA 名下（作为案件客户）的**多人案件**：过户给另一名参与人（cases.customer_id 改写，
 *     该参与人随之移出 case_applicants——案件客户不在参与表），案件与账目完整保留；
 *  2) TA 名下**单人案件**：只有 TA 一人 → 随客户外键级联整案删除（含递交/历史/账目）；
 *  3) TA 参与的他人案件：case_applicants 级联删 → 自动移出参与人，案件不受影响；
 *  4) 最后真删客户（其文件/记录级联删；payments 的 applicant/付款方引用置空）。
 * RLS 仅 admin 可执行。
 */
export async function deleteCustomer(id: string): Promise<void> {
  // ① 名下案件
  const owned = await supabase.from('cases').select('id').eq('customer_id', id)
  if (owned.error) throw owned.error
  for (const c of owned.data ?? []) {
    // ② 找一名其他参与人作为新案件客户
    const subs = await supabase
      .from('case_applicants')
      .select('customer_id')
      .eq('case_id', c.id)
      .neq('customer_id', id)
    if (subs.error) throw subs.error
    const heir = subs.data?.[0]?.customer_id
    if (!heir) continue // 单人案件：留给级联随客户一起删
    // ③ 过户 + ④ 新案件客户移出参与表
    const up = await supabase.from('cases').update({ customer_id: heir }).eq('id', c.id)
    if (up.error) throw up.error
    const rm = await supabase.from('case_applicants').delete().eq('case_id', c.id).eq('customer_id', heir)
    if (rm.error) throw rm.error
  }
  // ⑤ 真删客户。DELETE 被 RLS 挡掉时是「命中 0 行、不报错」——必须 select 校验行数并显式抛错，
  //    否则上面的过户/移出参与人已写入，会留下"客户没删成但案件归属被改"的脏数据且无任何提示。
  const { data, error } = await supabase.from('customers').delete().eq('id', id).select('id')
  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('删除失败：未删除任何数据（客户可能已被删除）')
  }
}

/** 取消归档（回收站恢复）。只动客户本体——案件本就未受归档影响。 */
export async function unarchiveCustomer(id: string): Promise<void> {
  const { error } = await supabase
    .from('customers')
    .update({ is_archived: false })
    .eq('id', id)
  if (error) throw error
}
