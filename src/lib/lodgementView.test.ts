import { describe, expect, it } from 'vitest'
import { lodgementCardStatus, selectLodgementTimeline } from './lodgementView'
import type { CaseStageHistory, Lodgement } from '../types/models'

const lg = (o: Partial<Lodgement>): Lodgement =>
  ({ id: 'l', case_id: 'c1', type: 'nomination', lodged_date: null, reference_number: null, dha_processing_days: null, dha_processing_updated_at: null, outcome: 'pending', outcome_date: null, note: null, created_by: null, created_at: '', updated_at: '2026-05-01T10:00:00Z', ...o }) as Lodgement
const sh = (o: Partial<CaseStageHistory>): CaseStageHistory =>
  ({ id: 'h', case_id: 'c1', from_stage: null, to_stage: 'todo', note: null, changed_by: null, changed_at: '', effective_at: '', ...o }) as CaseStageHistory

describe('lodgementCardStatus', () => {
  it('未递交 → 待递交(橙)', () => {
    expect(lodgementCardStatus(null, 'pending')).toMatchObject({ lodged: false, label: '待递交', tone: 'amber' })
  })
  it('已递交·待决 → 已递交(绿)', () => {
    expect(lodgementCardStatus('2026-02-10', 'pending', lg({ updated_at: '2026-03-01T00:00:00Z' }))).toMatchObject({
      lodged: true, label: '已递交', tone: 'emerald', lastUpdated: '2026-03-01',
    })
  })
  it('已批 → 已获批(绿)；已拒 → 已拒签(红)', () => {
    expect(lodgementCardStatus('2026-02-10', 'approved')).toMatchObject({ label: '已获批', tone: 'emerald' })
    expect(lodgementCardStatus('2026-02-10', 'refused')).toMatchObject({ label: '已拒签', tone: 'rose' })
  })
  it('无 lodgement → lastUpdated 为 null（不显假日期）', () => {
    expect(lodgementCardStatus(null, 'pending').lastUpdated).toBeNull()
  })
})

describe('selectLodgementTimeline', () => {
  it('合并阶段历史 + lodgement outcome，按日期倒序', () => {
    const history = [
      sh({ id: 'h1', to_stage: 'nomination_lodged', effective_at: '2026-02-10T00:00:00Z', note: '提名已递交' }),
      sh({ id: 'h2', to_stage: 'todo', effective_at: '2026-01-05T00:00:00Z' }),
    ]
    const lods = [lg({ id: 'ln', type: 'nomination', outcome: 'approved', outcome_date: '2026-04-01' })]
    const t = selectLodgementTimeline(history, lods)
    expect(t.map((x) => x.date)).toEqual(['2026-04-01', '2026-02-10', '2026-01-05']) // 倒序
    expect(t[0]).toMatchObject({ stage: null, title: '提名批准' }) // outcome 事件（类型+结果标签）
    expect(t[1]).toMatchObject({ stage: 'nomination_lodged', title: '提名递交', note: '提名已递交' })
  })
  it('outcome=pending 或无结果日期 → 不进时间线（不编）', () => {
    const t = selectLodgementTimeline([], [lg({ outcome: 'pending', outcome_date: null }), lg({ id: 'l2', outcome: 'approved', outcome_date: null })])
    expect(t).toHaveLength(0)
  })
  it('空输入不崩', () => {
    expect(selectLodgementTimeline([], [])).toEqual([])
  })
})
