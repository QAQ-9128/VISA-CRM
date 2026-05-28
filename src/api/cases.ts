import { supabase } from '../lib/supabase'
import type { Case, CaseInsert, CaseStageHistory, CaseUpdate } from '../types/models'
import type { CaseStage } from '../types/domain'

/** 某客户名下的案件，默认排除归档，按创建时间倒序。 */
export async function listCasesByCustomer(
  customerId: string,
  opts: { includeArchived?: boolean } = {},
): Promise<Case[]> {
  let query = supabase.from('cases').select('*').eq('customer_id', customerId)
  if (!opts.includeArchived) query = query.eq('is_archived', false)
  query = query.order('created_at', { ascending: false })
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

/** 全部案件（看板用），默认排除归档，按创建时间倒序。 */
export async function listCases(opts: { includeArchived?: boolean } = {}): Promise<Case[]> {
  let query = supabase.from('cases').select('*')
  if (!opts.includeArchived) query = query.eq('is_archived', false)
  query = query.order('created_at', { ascending: false })
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getCase(id: string): Promise<Case | null> {
  const { data, error } = await supabase.from('cases').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function createCase(input: CaseInsert): Promise<Case> {
  const { data, error } = await supabase.from('cases').insert(input).select().single()
  if (error) throw error
  return data
}

/** 更新非阶段字段（visa_subclass / currency / destination_country 等）。阶段流转走 updateCaseStage。 */
export async function updateCase(id: string, patch: CaseUpdate): Promise<Case> {
  const { data, error } = await supabase
    .from('cases')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export interface UpdateCaseStageParams {
  caseId: string
  fromStage: CaseStage | null
  toStage: CaseStage
  note?: string | null
  changedBy?: string | null
}

/** 切换阶段：更新 cases.current_stage 并写一条 case_stage_history（可附备注）。 */
export async function updateCaseStage({
  caseId,
  fromStage,
  toStage,
  note,
  changedBy,
}: UpdateCaseStageParams): Promise<Case> {
  const { data, error } = await supabase
    .from('cases')
    .update({ current_stage: toStage })
    .eq('id', caseId)
    .select()
    .single()
  if (error) throw error

  const { error: histError } = await supabase.from('case_stage_history').insert({
    case_id: caseId,
    from_stage: fromStage,
    to_stage: toStage,
    note: note ?? null,
    changed_by: changedBy ?? null,
  })
  if (histError) throw histError

  return data
}

/** 阶段变更时间线，按时间倒序。 */
export async function getCaseStageHistory(caseId: string): Promise<CaseStageHistory[]> {
  const { data, error } = await supabase
    .from('case_stage_history')
    .select('*')
    .eq('case_id', caseId)
    .order('changed_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

/** 归档 = 软删除。 */
export async function archiveCase(id: string): Promise<void> {
  const { error } = await supabase.from('cases').update({ is_archived: true }).eq('id', id)
  if (error) throw error
}
