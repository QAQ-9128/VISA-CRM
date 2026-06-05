import { supabase } from '../lib/supabase'
import type { CaseApplicant } from '../types/models'

/** 某案件的参与人关联（参与人 = 案件客户 cases.customer_id + 本表成员）。 */
export async function listCaseApplicants(caseId: string): Promise<CaseApplicant[]> {
  const { data, error } = await supabase
    .from('case_applicants')
    .select('*')
    .eq('case_id', caseId)
  if (error) throw error
  return data ?? []
}

/** 全部案件申请人关联（财务页 / 案件表的全局拼装用）。 */
export async function listAllCaseApplicants(): Promise<CaseApplicant[]> {
  const { data, error } = await supabase.from('case_applicants').select('*')
  if (error) throw error
  return data ?? []
}

/** 增量添加单个参与人关联（unique(case_id,customer_id) 防重，UI 只在未关联时提供）。 */
export async function addCaseApplicant(caseId: string, customerId: string): Promise<void> {
  const { error } = await supabase
    .from('case_applicants')
    .insert({ case_id: caseId, customer_id: customerId })
  if (error) throw error
}

/**
 * TA 把自己移出某案件（2026-06-05：任何参与人都可、且只能移自己，无案件客户特权之分）：
 *  - 普通成员 → 删自己的 case_applicants 行；
 *  - 案件客户 → 本案过户给另一参与人（cases.customer_id 改写 + 该参与人移出参与表），账目原样保留；
 *  - 唯一参与人 → 拒绝（案件不能没有人），提示改用「归档本案」或「彻底删除本案」。
 */
export async function removeSelfFromCase(caseId: string, customerId: string): Promise<void> {
  const kase = await supabase.from('cases').select('customer_id').eq('id', caseId).maybeSingle()
  if (kase.error) throw kase.error
  if (kase.data?.customer_id !== customerId) {
    // 普通成员：删自己的关联即可
    return removeCaseApplicant(caseId, customerId)
  }
  // 案件客户：找另一参与人过户
  const subs = await supabase
    .from('case_applicants')
    .select('customer_id')
    .eq('case_id', caseId)
    .neq('customer_id', customerId)
  if (subs.error) throw subs.error
  const heir = subs.data?.[0]?.customer_id
  if (!heir) throw new Error('你是本案唯一参与人，不能移出自己；可改用「归档本案」或「彻底删除本案」')
  const up = await supabase.from('cases').update({ customer_id: heir }).eq('id', caseId)
  if (up.error) throw up.error
  const rm = await supabase.from('case_applicants').delete().eq('case_id', caseId).eq('customer_id', heir)
  if (rm.error) throw rm.error
}

/** 移除单个参与人关联。 */
export async function removeCaseApplicant(caseId: string, customerId: string): Promise<void> {
  const { error } = await supabase
    .from('case_applicants')
    .delete()
    .eq('case_id', caseId)
    .eq('customer_id', customerId)
  if (error) throw error
}

/** 覆盖式设置某案件的参与人：先删旧关联，再插入选中的客户。 */
export async function setCaseApplicants(caseId: string, customerIds: string[]): Promise<void> {
  const del = await supabase.from('case_applicants').delete().eq('case_id', caseId)
  if (del.error) throw del.error
  if (customerIds.length === 0) return
  const rows = customerIds.map((customer_id) => ({ case_id: caseId, customer_id }))
  const ins = await supabase.from('case_applicants').insert(rows)
  if (ins.error) throw ins.error
}
