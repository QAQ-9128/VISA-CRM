/**
 * 「一键添加家庭成员」精简表单的纯逻辑：关系解析 / 校验 / 落库载荷。
 * 只产出 customers 的四个字段，不碰 case / sync / TRT。
 */

/** 关系下拉选项（最后一项「其他」可手填）。 */
export const FAMILY_RELATIONSHIPS = ['配偶', '子女', '父母', '其他'] as const
export const RELATIONSHIP_OTHER = '其他'

export interface FamilyMemberForm {
  full_name: string
  /** '' | 'male' | 'female' */
  gender: string
  /** '' 或 yyyy-mm-dd */
  birth_date: string
  /** FAMILY_RELATIONSHIPS 之一，或 '' 表示未选 */
  relationship: string
  /** 关系选「其他」时的手填文本 */
  relationshipOther: string
}

export interface FamilyMemberPayload {
  full_name: string
  gender: string | null
  birth_date: string | null
  relationship_to_primary: string | null
}

/** 关系落库值：「其他」+手填非空 → 手填文本；「其他」+手填空 → 存「其他」；未选 → null；其余原样。 */
export function resolveRelationship(relationship: string, other: string): string | null {
  if (relationship === '') return null
  if (relationship === RELATIONSHIP_OTHER) {
    const t = other.trim()
    return t === '' ? RELATIONSHIP_OTHER : t
  }
  return relationship
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 校验：姓名必填；生日不可为未来。返回错误文案，或 null 表示通过。 */
export function validateFamilyMember(
  form: Pick<FamilyMemberForm, 'full_name' | 'birth_date'>,
  today: Date = new Date(),
): string | null {
  if (form.full_name.trim() === '') return '请填写姓名'
  if (form.birth_date && form.birth_date > ymd(today)) return '生日不能是未来日期'
  return null
}

/** 组装落库载荷：仅四字段，空值落 null。 */
export function buildFamilyMemberPayload(form: FamilyMemberForm): FamilyMemberPayload {
  return {
    full_name: form.full_name.trim(),
    gender: form.gender || null,
    birth_date: form.birth_date || null,
    relationship_to_primary: resolveRelationship(form.relationship, form.relationshipOther),
  }
}
