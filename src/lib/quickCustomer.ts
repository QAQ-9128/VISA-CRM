import type { CustomerInsert } from '../types/models'

/**
 * 快速建档卡片表单模型：只有五个字段，**不含任何案件/家庭组键**——
 * 首次新建客户就是单独建档（2026-06 图纸拍板），案件后续去客户页里建。
 * 与完整表单同页并存（新建客户页左卡），不是替代。
 */
export interface QuickCustomerState {
  full_name: string
  gender: string
  birth_date: string
  /** 归属人（referrers.kind=owner 实体 id；'' = 未归属） */
  owner_referrer_id: string
  referrer_id: string
}

export function initialQuickState(): QuickCustomerState {
  return { full_name: '', gender: '', birth_date: '', owner_referrer_id: '', referrer_id: '' }
}

/** 空串转 null、姓名 trim；键集固定为五个（测试锁定，防止悄悄夹带案件字段）。 */
export function toQuickPayload(s: QuickCustomerState): CustomerInsert {
  return {
    full_name: s.full_name.trim(),
    gender: s.gender || null,
    birth_date: s.birth_date || null,
    owner_referrer_id: s.owner_referrer_id || null,
    referrer_id: s.referrer_id || null,
  }
}
