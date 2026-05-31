import { supabase } from '../lib/supabase'
import type { Case, CaseInsert, CaseStageHistory, CaseUpdate } from '../types/models'
import type { TablesUpdate } from '../types/database'
import type { CaseStage } from '../types/domain'

export type CaseStageHistoryUpdate = TablesUpdate<'case_stage_history'>

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
  /** 阶段实际发生时间（支持事后补录过去日期）；不传则用 DB 默认 now()。 */
  effectiveAt?: string | null
}

/** 切换阶段：更新 cases.current_stage 并写一条 case_stage_history（可附备注 + 实际发生时间）。 */
export async function updateCaseStage({
  caseId,
  fromStage,
  toStage,
  note,
  changedBy,
  effectiveAt,
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
    ...(effectiveAt ? { effective_at: effectiveAt } : {}),
  })
  if (histError) throw histError

  return data
}

/** 改某条阶段历史（如实际发生时间 effective_at）。case_stage 是案件表字段，独立于历史，删改不影响当前阶段。 */
export async function updateStageHistory(
  id: string,
  patch: CaseStageHistoryUpdate,
): Promise<CaseStageHistory> {
  const { data, error } = await supabase
    .from('case_stage_history')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/** 删除某条阶段历史（不影响 cases.current_stage）。 */
export async function deleteStageHistory(id: string): Promise<void> {
  const { error } = await supabase.from('case_stage_history').delete().eq('id', id)
  if (error) throw error
}

/** 全部案件的阶段历史（递交进度表算「决定日期」冻结距今用）。 */
export async function listAllStageHistory(): Promise<CaseStageHistory[]> {
  const { data, error } = await supabase.from('case_stage_history').select('*')
  if (error) throw error
  return data ?? []
}

/** 阶段变更时间线，按实际发生时间倒序。 */
export async function getCaseStageHistory(caseId: string): Promise<CaseStageHistory[]> {
  const { data, error } = await supabase
    .from('case_stage_history')
    .select('*')
    .eq('case_id', caseId)
    .order('effective_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

/** 归档 = 软删除。 */
export async function archiveCase(id: string): Promise<void> {
  const { error } = await supabase.from('cases').update({ is_archived: true }).eq('id', id)
  if (error) throw error
}

/**
 * 彻底删除（硬删，不可恢复）：真 DELETE。级联删除该案件的递交记录、阶段历史、付款计划/分期/收付款、
 * 副申请关联、案件级文件/记录/待办。RLS 仅 admin 可执行。
 */
export async function deleteCase(id: string): Promise<void> {
  const { error } = await supabase.from('cases').delete().eq('id', id)
  if (error) throw error
}
