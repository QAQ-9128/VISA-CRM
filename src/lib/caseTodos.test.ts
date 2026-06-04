import { describe, expect, it } from 'vitest'
import { selectCaseTodos } from './caseTodos'
import type { CaseDocument, RecordRow } from '../types/models'

const mkRec = (o: Partial<RecordRow>): RecordRow => ({
  id: 'r1', customer_id: 'cu1', case_id: 'ca1', type: 'task', content: '待办内容', due_date: null,
  is_done: false, done_at: null, assigned_to: null, channel: null, emoji_marker: null,
  created_by: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', ...o,
})
const mkDoc = (o: Partial<CaseDocument>): CaseDocument => ({
  id: 'd1', customer_id: 'cu1', case_id: 'ca1', doc_type: 'other', title: null, storage_path: null,
  file_name: null, issue_date: null, expiry_date: null, note: null, uploaded_by: null,
  is_archived: false, created_at: '', updated_at: '', ...o,
})

const TODAY = new Date('2026-06-03T00:00:00Z')

describe('selectCaseTodos', () => {
  it('全空 → 空数组', () => {
    expect(selectCaseTodos({ records: [], docs: [], trt: { show: false, months: 0 }, today: TODAY })).toEqual([])
  })

  it('TRT 显示时排在最前', () => {
    const out = selectCaseTodos({ records: [], docs: [], trt: { show: true, months: 25 }, today: TODAY })
    expect(out).toHaveLength(1)
    expect(out[0].kind).toBe('trt')
    expect(out[0].sub).toContain('25')
  })

  it('只收 overdue/soon 文件，ok 文件不计；过期=rose，临近=amber', () => {
    const out = selectCaseTodos({
      records: [],
      docs: [
        mkDoc({ id: 'past', title: '体检报告', expiry_date: '2026-05-01' }), // overdue
        mkDoc({ id: 'soon', title: '签证', expiry_date: '2026-06-20' }), // soon (<=30d)
        mkDoc({ id: 'ok', title: '护照', expiry_date: '2027-01-01' }), // ok → 不计
      ],
      trt: { show: false, months: 0 },
      today: TODAY,
    })
    expect(out.map((i) => i.id)).toEqual(['doc-past', 'doc-soon'])
    expect(out[0].tone).toBe('rose')
    expect(out[0].badge).toMatch(/已过期/)
    expect(out[1].tone).toBe('amber')
    expect(out[1].badge).toMatch(/天后到期/)
  })

  it('归档文件不计', () => {
    const out = selectCaseTodos({
      records: [],
      docs: [mkDoc({ id: 'arch', expiry_date: '2026-05-01', is_archived: true })],
      trt: { show: false, months: 0 },
      today: TODAY,
    })
    expect(out).toEqual([])
  })

  it('只收未完成待办（task 且 !is_done），跟进/已完成不计；带截止日徽标', () => {
    const out = selectCaseTodos({
      records: [
        mkRec({ id: 't-open', content: '催 PTE', due_date: '2026-07-01' }),
        mkRec({ id: 't-done', content: '已办', is_done: true }),
        mkRec({ id: 'f1', type: 'follow_up', content: '电话沟通' }),
      ],
      docs: [],
      trt: { show: false, months: 0 },
      today: TODAY,
    })
    expect(out.map((i) => i.id)).toEqual(['task-t-open'])
    expect(out[0].badge).toBe('截止 2026-07-01')
  })

  it('顺序：TRT → 文件 → 待办', () => {
    const out = selectCaseTodos({
      records: [mkRec({ id: 'tk', content: 'x' })],
      docs: [mkDoc({ id: 'dd', expiry_date: '2026-05-01' })],
      trt: { show: true, months: 24 },
      today: TODAY,
    })
    expect(out.map((i) => i.kind)).toEqual(['trt', 'expiry', 'task'])
  })
})
