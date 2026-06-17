import { supabase } from '../lib/supabase'
import { recomputeStageAfterDelete } from '../lib/stageHistory'
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

/** 全部案件（案件列表/递交进度等全局视图用），默认排除归档，按创建时间倒序。 */
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

/** 底层删除某条阶段历史（不联动当前阶段）。当前阶段联动请用 deleteLatestStageHistory。 */
export async function deleteStageHistory(id: string): Promise<void> {
  const { error } = await supabase.from('case_stage_history').delete().eq('id', id)
  if (error) throw error
}

/**
 * 删除某条阶段流转，并把 cases.current_stage **重算回退**——当前阶段是从流转记录派生的单一来源：
 * 删最新一条 → 当前阶段回到上一个；删到空 → 回到被删那条的来源阶段（初始）。
 * 删后从库重取剩余记录（不信任客户端缓存）再重算写回，保证当前阶段与历史一致、绝不脱钩。
 * 纯逻辑 + 既有表，无结构变更/无 migration。返回重算后的当前阶段。
 */
export async function deleteLatestStageHistory(row: CaseStageHistory): Promise<CaseStage> {
  const { error } = await supabase.from('case_stage_history').delete().eq('id', row.id)
  if (error) throw error

  const { data: remaining, error: selError } = await supabase
    .from('case_stage_history')
    .select('*')
    .eq('case_id', row.case_id)
  if (selError) throw selError

  const newStage = recomputeStageAfterDelete(remaining ?? [], row)
  const { error: upError } = await supabase
    .from('cases')
    .update({ current_stage: newStage })
    .eq('id', row.case_id)
  if (upError) throw upError

  return newStage
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

/** 取消归档（回收站恢复）。 */
export async function unarchiveCase(id: string): Promise<void> {
  const { error } = await supabase.from('cases').update({ is_archived: false }).eq('id', id)
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
