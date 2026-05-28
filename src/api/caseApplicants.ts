import { supabase } from '../lib/supabase'
import type { CaseApplicant } from '../types/models'

/** 某案件的副申请人关联（主申是 cases.customer_id，不在此表）。 */
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

/** 覆盖式设置某案件的副申请人：先删旧关联，再插入选中的客户。 */
export async function setCaseApplicants(caseId: string, customerIds: string[]): Promise<void> {
  const del = await supabase.from('case_applicants').delete().eq('case_id', caseId)
  if (del.error) throw del.error
  if (customerIds.length === 0) return
  const rows = customerIds.map((customer_id) => ({ case_id: caseId, customer_id }))
  const ins = await supabase.from('case_applicants').insert(rows)
  if (ins.error) throw ins.error
}
