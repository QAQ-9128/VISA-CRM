import { describe, expect, it } from 'vitest'
import { selectOccupationalMilestones } from './occupationalMilestones'
import { localYmd } from './dateRules'
import type { CaseStageHistory } from '../types/models'

// 用午间 UTC 时间戳，避免本地时区把日期偏移到前后一天（断言用 localYmd 同源计算，TZ 无关）
const h = (o: Partial<CaseStageHistory>): CaseStageHistory =>
  ({ id: 'h', case_id: 'c', from_stage: null, to_stage: 'oa_skill_submitted', note: null,
    effective_at: '2026-06-10T03:00:00Z', changed_at: '2026-06-10T03:00:00Z', changed_by: null, created_at: '',
    ...o } as CaseStageHistory)

describe('occupationalMilestones · 顶部两卡从阶段史派生（§7）', () => {
  it('空历史 → 两项均 null', () => {
    expect(selectOccupationalMilestones([])).toEqual({ skillSubmittedDate: null, outcome: null })
  })

  it('技术评估递交 = 最近一次 oa_skill_submitted 的本地日期', () => {
    const hist = [
      h({ id: 'a', to_stage: 'oa_chn_verification', effective_at: '2026-05-01T03:00:00Z' }),
      h({ id: 'b', to_stage: 'oa_skill_submitted', effective_at: '2026-06-10T03:00:00Z' }),
    ]
    const m = selectOccupationalMilestones(hist)
    expect(m.skillSubmittedDate).toBe(localYmd(new Date('2026-06-10T03:00:00Z')))
    expect(m.outcome).toBeNull()
  })

  it('多次递交取最近一次（按 effective_at）', () => {
    const hist = [
      h({ id: 'a', to_stage: 'oa_skill_submitted', effective_at: '2026-06-01T03:00:00Z' }),
      h({ id: 'b', to_stage: 'oa_skill_submitted', effective_at: '2026-06-20T03:00:00Z' }),
    ]
    expect(selectOccupationalMilestones(hist).skillSubmittedDate).toBe(localYmd(new Date('2026-06-20T03:00:00Z')))
  })

  it('评估结果 = 最近一次 positive/negative（带结果 + 日期）', () => {
    const hist = [
      h({ id: 'b', to_stage: 'oa_skill_submitted', effective_at: '2026-06-10T03:00:00Z' }),
      h({ id: 'c', to_stage: 'oa_positive', effective_at: '2026-07-01T03:00:00Z' }),
    ]
    const m = selectOccupationalMilestones(hist)
    expect(m.outcome).toEqual({ stage: 'oa_positive', date: localYmd(new Date('2026-07-01T03:00:00Z')) })
  })

  it('负面结果同样识别', () => {
    const hist = [h({ id: 'c', to_stage: 'oa_negative', effective_at: '2026-07-02T03:00:00Z' })]
    expect(selectOccupationalMilestones(hist).outcome?.stage).toBe('oa_negative')
  })
})
