import type { Customer, CustomerInsert } from '../types/models'
import { customerDisplayName } from './customerName'

/** 客户表单提交值（full_name 必填——保存时由「中文 ?? 英文 ?? 旧值」派生）。 */
export interface CustomerFormValues extends CustomerInsert {
  full_name: string
}

/** 客户表单内部状态（全字段字符串化，便于受控输入）。 */
export interface CustomerFormState {
  /** 旧姓名字段：仅作老数据兜底（编辑时回填，无 UI 输入框） */
  full_name: string
  /** 中文名（与英文名至少填一个；老数据可两空靠 full_name 兜底） */
  chinese_name: string
  /** 英文名（录入约定「姓全大写 + 名首字母大写」如 DENG Tao；原样保存） */
  english_name: string
  primary_applicant_id: string
  relationship_to_primary: string
  client_source: string
  /** 客户标签（傻逼 / 大傻逼 / 正常人 / 聪明人；'' = 未打标） */
  tag: string
  is_starred: boolean
  sponsor_employer_id: string
  sponsor_position: string
  referrer_id: string
  /** 归属人（referrers.kind=owner 实体 id；'' = 未归属），与 client_source 三色无关 */
  owner_referrer_id: string
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
    chinese_name: c?.chinese_name ?? '',
    english_name: c?.english_name ?? '',
    primary_applicant_id: c?.primary_applicant_id ?? initialPrimaryId ?? '',
    relationship_to_primary: c?.relationship_to_primary ?? '',
    client_source: c?.client_source ?? '',
    tag: c?.tag ?? '',
    is_starred: c?.is_starred ?? false,
    sponsor_employer_id: c?.sponsor_employer_id ?? '',
    sponsor_position: c?.sponsor_position ?? '',
    referrer_id: c?.referrer_id ?? '',
    owner_referrer_id: c?.owner_referrer_id ?? '',
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
    // full_name = 中文 ?? 英文 ?? 旧值（老数据两栏全空时保留原名不清空）
    full_name: customerDisplayName({ chinese_name: s.chinese_name, english_name: s.english_name, full_name: s.full_name }),
    chinese_name: trimOrNull(s.chinese_name),
    english_name: trimOrNull(s.english_name),
    primary_applicant_id: isSub ? s.primary_applicant_id : null,
    relationship_to_primary: isSub ? trimOrNull(s.relationship_to_primary) : null,
    client_source: s.client_source || null,
    tag: s.tag || null,
    is_starred: s.is_starred,
    sponsor_employer_id: s.sponsor_employer_id || null,
    sponsor_position: trimOrNull(s.sponsor_position),
    referrer_id: s.referrer_id || null,
    owner_referrer_id: s.owner_referrer_id || null,
    birth_date: trimOrNull(s.birth_date),
    gender: s.gender || null,
    notes: trimOrNull(s.notes),
  }
}
