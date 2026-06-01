import { describe, expect, it } from 'vitest'
import {
  resolveRelationship,
  validateFamilyMember,
  buildFamilyMemberPayload,
  RELATIONSHIP_OTHER,
} from './familyMember'

const TODAY = new Date(2026, 5, 1) // 2026-06-01

describe('resolveRelationship（关系落库值）', () => {
  it('普通选项原样存', () => {
    expect(resolveRelationship('配偶', '')).toBe('配偶')
    expect(resolveRelationship('子女', '')).toBe('子女')
  })
  it('选「其他」+ 手填非空 → 存手填文本', () => {
    expect(resolveRelationship(RELATIONSHIP_OTHER, '继女')).toBe('继女')
  })
  it('选「其他」+ 手填空 → 存「其他」', () => {
    expect(resolveRelationship(RELATIONSHIP_OTHER, '   ')).toBe(RELATIONSHIP_OTHER)
  })
  it('未选关系 → null', () => {
    expect(resolveRelationship('', '')).toBeNull()
  })
})

describe('validateFamilyMember（姓名必填 + 生日不可未来）', () => {
  it('姓名空 → 报错、不提交', () => {
    expect(validateFamilyMember({ full_name: '   ', birth_date: '' }, TODAY)).toBe('请填写姓名')
  })
  it('生日是未来 → 报错', () => {
    expect(validateFamilyMember({ full_name: '小明', birth_date: '2026-06-02' }, TODAY)).toBe('生日不能是未来日期')
  })
  it('生日是今天/过去 → 通过', () => {
    expect(validateFamilyMember({ full_name: '小明', birth_date: '2026-06-01' }, TODAY)).toBeNull()
    expect(validateFamilyMember({ full_name: '小明', birth_date: '2010-01-01' }, TODAY)).toBeNull()
  })
  it('姓名有、生日空 → 通过', () => {
    expect(validateFamilyMember({ full_name: '小明', birth_date: '' }, TODAY)).toBeNull()
  })
})

describe('buildFamilyMemberPayload（仅四字段，空值落 null）', () => {
  it('全填', () => {
    expect(
      buildFamilyMemberPayload({ full_name: ' 小明 ', gender: 'male', birth_date: '2010-01-01', relationship: '子女', relationshipOther: '' }),
    ).toEqual({ full_name: '小明', gender: 'male', birth_date: '2010-01-01', relationship_to_primary: '子女' })
  })
  it('只填姓名，其余空 → null', () => {
    expect(
      buildFamilyMemberPayload({ full_name: '李雷', gender: '', birth_date: '', relationship: '', relationshipOther: '' }),
    ).toEqual({ full_name: '李雷', gender: null, birth_date: null, relationship_to_primary: null })
  })
  it('关系=其他手填 → 存手填', () => {
    expect(
      buildFamilyMemberPayload({ full_name: '王芳', gender: 'female', birth_date: '', relationship: RELATIONSHIP_OTHER, relationshipOther: '岳母' }).relationship_to_primary,
    ).toBe('岳母')
  })
})
