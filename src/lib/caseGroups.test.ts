import { describe, expect, it } from 'vitest'
import { caseGroupCode, caseGroupKey, caseParticipantIds } from './caseGroups'
import type { Case, CaseApplicant } from '../types/models'

const mkCase = (o: Partial<Case>): Case =>
  ({ id: 'ca1', customer_id: 'A', ...o }) as Case
const ap = (case_id: string, customer_id: string): CaseApplicant =>
  ({ id: `${case_id}-${customer_id}`, case_id, customer_id, created_at: '' }) as CaseApplicant

describe('一案一组：组 = 案件参与人集合（不再按客户关联传递合并）', () => {
  it('参与人 = 案件客户(在前) + 本案参与客户；只取本案的 applicants', () => {
    const applicants = [ap('ca1', 'B'), ap('ca2', 'C'), ap('ca1', 'A') /* 重复 owner 去重 */]
    expect(caseParticipantIds(mkCase({ id: 'ca1', customer_id: 'A' }), applicants)).toEqual(['A', 'B'])
  })

  it('独立案件（无参与人）→ 自己一组', () => {
    expect(caseParticipantIds(mkCase({ id: 'ca1', customer_id: 'A' }), [])).toEqual(['A'])
  })

  it('A+B 案与 A+C 案是两个不同的组（A 同时在两组里，不传递合并）', () => {
    const ab = caseGroupCode(caseParticipantIds(mkCase({ id: 'c1', customer_id: 'A' }), [ap('c1', 'B')]), 'c1')
    const ac = caseGroupCode(caseParticipantIds(mkCase({ id: 'c2', customer_id: 'A' }), [ap('c2', 'C')]), 'c2')
    const aSolo = caseGroupCode(caseParticipantIds(mkCase({ id: 'c3', customer_id: 'A' }), []), 'c3')
    expect(ab).not.toBe(ac)
    expect(ab).not.toBe(aSolo)
    expect(ac).not.toBe(aSolo)
  })

  it('同一个人的不同案件 → 各自一组（单人不跨案合并）', () => {
    const c1 = caseGroupCode(['A'], 'c1')
    const c2 = caseGroupCode(['A'], 'c2')
    expect(c1).not.toBe(c2)
  })

  it('多人同参与人集合 ⇒ 同组同码（与 owner 是谁、顺序、案件 id 无关）', () => {
    // 同一拨人（A、B）办两个案件，owner 不同也算同组
    const c1 = caseGroupCode(caseParticipantIds(mkCase({ id: 'c1', customer_id: 'A' }), [ap('c1', 'B')]), 'c1')
    const c2 = caseGroupCode(caseParticipantIds(mkCase({ id: 'c2', customer_id: 'B' }), [ap('c2', 'A')]), 'c2')
    expect(c1).toBe(c2)
    expect(c1).toMatch(/^G-[0-9A-Z]{4}$/)
  })

  it('组键：多人 = 排序去重集合；单人 = 集合 + 案件 id（一案一组）', () => {
    expect(caseGroupKey(['B', 'A', 'B'], 'c1')).toBe('A|B')
    expect(caseGroupKey(['A'], 'c1')).toBe('A#c1')
    expect(caseGroupKey(['A'], 'c2')).toBe('A#c2')
  })
})
