import { describe, expect, it } from 'vitest'
import {
  stagesForCategory,
  isOccupationalCategory,
  isDeFactoCategory,
  usesFancyStageSelect,
  initialStageForCategory,
  isUnsetOccupationalStage,
} from './caseStages'
import { CASE_STAGES, OCCUPATIONAL_STAGES, DE_FACTO_STAGES } from '../types/domain'

describe('caseStages · 按案件大类取「切换到」阶段集合', () => {
  it('职业评估 → 专属 7 阶段（精确顺序，英文显示）', () => {
    const s = stagesForCategory('职业评估')
    expect(s).toEqual(OCCUPATIONAL_STAGES)
    expect(s).toHaveLength(7)
    expect(s).toEqual([
      'oa_chn_verification',
      'oa_skill_submitted',
      'oa_rfe',
      'oa_responded',
      'oa_approved',
      'oa_positive',
      'oa_negative',
    ])
  })

  it('De Facto 关系认定 → 专属 5 阶段（精确顺序，中英混排显示；28days Reminder 不是阶段、不在集合）', () => {
    const s = stagesForCategory('De Facto 关系认定')
    expect(s).toEqual(DE_FACTO_STAGES)
    expect(s).toHaveLength(5)
    expect(s).toEqual(['df_prep', 'df_submitted', 'df_rfe', 'df_responded', 'df_registered'])
    expect(s).not.toContain('df_reminder')
  })

  it('签证申请 / 定制文件 / 空 → 通用 CASE_STAGES（签证流程不动）', () => {
    expect(stagesForCategory('签证申请')).toEqual(CASE_STAGES)
    expect(stagesForCategory('定制文件')).toEqual(CASE_STAGES)
    expect(stagesForCategory(null)).toEqual(CASE_STAGES)
    expect(stagesForCategory(undefined)).toEqual(CASE_STAGES)
  })

  it('isOccupationalCategory 仅对「职业评估」为真；isDeFactoCategory 仅对 De Facto 为真', () => {
    expect(isOccupationalCategory('职业评估')).toBe(true)
    expect(isOccupationalCategory('De Facto 关系认定')).toBe(false)
    expect(isOccupationalCategory(null)).toBe(false)
    expect(isDeFactoCategory('De Facto 关系认定')).toBe(true)
    expect(isDeFactoCategory('职业评估')).toBe(false)
    expect(isDeFactoCategory('签证申请')).toBe(false)
  })

  it('usesFancyStageSelect：职业评估 / De Facto → true（圆点下拉）；签证类 / 空 → false（原生 Select）', () => {
    expect(usesFancyStageSelect('职业评估')).toBe(true)
    expect(usesFancyStageSelect('De Facto 关系认定')).toBe(true)
    expect(usesFancyStageSelect('签证申请')).toBe(false)
    expect(usesFancyStageSelect(null)).toBe(false)
  })

  it('initialStageForCategory：De Facto → df_prep；其它（职业评估/签证/空）→ null（用 DB 默认 todo）', () => {
    expect(initialStageForCategory('De Facto 关系认定')).toBe('df_prep')
    expect(initialStageForCategory('职业评估')).toBeNull()
    expect(initialStageForCategory('签证申请')).toBeNull()
    expect(initialStageForCategory(null)).toBeNull()
  })

  it('isUnsetOccupationalStage：职业评估 + 当前不在 7 阶段内 → true（显示「无」）；在集合内 → false；非职业评估恒 false', () => {
    // 未推进（新建默认 todo 等非 OA 值）→ 显示「无」
    expect(isUnsetOccupationalStage('职业评估', 'todo')).toBe(true)
    expect(isUnsetOccupationalStage('职业评估', null)).toBe(true)
    // 已推进到某个 OA 阶段 → 正常显示该阶段
    expect(isUnsetOccupationalStage('职业评估', 'oa_skill_submitted')).toBe(false)
    expect(isUnsetOccupationalStage('职业评估', 'oa_negative')).toBe(false)
    // 签证类不受影响（即便停在 todo 也照常显示待办，不显「无」）
    expect(isUnsetOccupationalStage('签证申请', 'todo')).toBe(false)
    expect(isUnsetOccupationalStage(null, 'todo')).toBe(false)
  })
})
