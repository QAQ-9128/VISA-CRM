import type { Customer, CustomerInsert } from '../types/models'

/** 客户表单提交值（full_name 必填）。 */
export interface CustomerFormValues extends CustomerInsert {
  full_name: string
}

/** 客户表单内部状态（全字段字符串化，便于受控输入）。 */
export interface CustomerFormState {
  full_name: string
  primary_applicant_id: string
  relationship_to_primary: string
  client_source: string
  is_starred: boolean
  sponsor_employer_id: string
  sponsor_position: string
  referrer_id: string
  birth_date: string
  gender: string
  notes: string
}

/**
 * 初始表单状态。
 * - 编辑：回填现有客户字段（其自身 primary_applicant_id 优先）。
 * - 新建：可用 initialPrimaryId 预选「挂靠到的主申请人」——从主申档案点「+ 添加副申请人」
 *   带 ?primary=<主申id> 进来时，自动挂靠到该主申，省去手动再选、避免漏挂。
 */
export function initialFormState(c?: Customer, initialPrimaryId?: string): CustomerFormState {
  return {
    full_name: c?.full_name ?? '',
    primary_applicant_id: c?.primary_applicant_id ?? initialPrimaryId ?? '',
    relationship_to_primary: c?.relationship_to_primary ?? '',
    client_source: c?.client_source ?? '',
    is_starred: c?.is_starred ?? false,
    sponsor_employer_id: c?.sponsor_employer_id ?? '',
    sponsor_position: c?.sponsor_position ?? '',
    referrer_id: c?.referrer_id ?? '',
    birth_date: c?.birth_date ?? '',
    gender: c?.gender ?? '',
    notes: c?.notes ?? '',
  }
}

const trimOrNull = (s: string) => (s.trim() === '' ? null : s.trim())

// 注意：电话/微信/邮箱/护照号/国籍/地址 已从表单移除，且**不写进 payload** —
// 编辑时这些键不出现在 update patch 里，数据库现有数据得以保留（不被清空）。
export function toPayload(s: CustomerFormState): CustomerFormValues {
  const isSub = s.primary_applicant_id !== ''
  return {
    full_name: s.full_name.trim(),
    primary_applicant_id: isSub ? s.primary_applicant_id : null,
    relationship_to_primary: isSub ? trimOrNull(s.relationship_to_primary) : null,
    client_source: s.client_source || null,
    is_starred: s.is_starred,
    sponsor_employer_id: s.sponsor_employer_id || null,
    sponsor_position: trimOrNull(s.sponsor_position),
    referrer_id: s.referrer_id || null,
    birth_date: trimOrNull(s.birth_date),
    gender: s.gender || null,
    notes: trimOrNull(s.notes),
  }
}
