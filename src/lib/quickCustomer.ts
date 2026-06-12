import type { CustomerInsert } from '../types/models'
import { customerDisplayName } from './customerName'

/**
 * 快速建档卡片表单模型：中文名/英文名 + 四字段，**不含任何案件/家庭组键**——
 * 首次新建客户就是单独建档（2026-06 图纸拍板），案件后续去客户页里建。
 * 与完整表单同页并存（新建客户页左卡），不是替代。
 */
export interface QuickCustomerState {
  /** 中文名（与英文名至少填一个） */
  chinese_name: string
  /** 英文名（录入约定「姓全大写 + 名首字母大写」如 DENG Tao；原样保存，不改大小写） */
  english_name: string
  gender: string
  birth_date: string
  /** 归属人（referrers.kind=owner 实体 id；'' = 未归属） */
  owner_referrer_id: string
  referrer_id: string
}

export function initialQuickState(): QuickCustomerState {
  return { chinese_name: '', english_name: '', gender: '', birth_date: '', owner_referrer_id: '', referrer_id: '' }
}

/**
 * 空串转 null、名字 trim；键集固定为七个（测试锁定，防止悄悄夹带案件字段）。
 * full_name = 派生显示名（中文 ?? 英文）：DB not null + 排序/搜索/老消费方兼容。
 */
export function toQuickPayload(s: QuickCustomerState): CustomerInsert {
  const zh = s.chinese_name.trim()
  const en = s.english_name.trim()
  return {
    full_name: customerDisplayName({ chinese_name: zh, english_name: en }),
    chinese_name: zh || null,
    english_name: en || null,
    gender: s.gender || null,
    birth_date: s.birth_date || null,
    owner_referrer_id: s.owner_referrer_id || null,
    referrer_id: s.referrer_id || null,
  }
}
