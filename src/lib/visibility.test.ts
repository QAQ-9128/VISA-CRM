import { describe, expect, it } from 'vitest'
import { visibleCaseIds } from './visibility'

describe('visibleCaseIds', () => {
  it('只保留主申客户仍在册的案件（归档客户的案件被隐藏）', () => {
    const cases = [
      { id: 'c1', customer_id: 'active1' },
      { id: 'c2', customer_id: 'archivedOrGone' },
      { id: 'c3', customer_id: 'active2' },
    ]
    const customerById = { active1: { id: 'active1' }, active2: { id: 'active2' } }
    const ids = visibleCaseIds(cases, customerById)
    expect([...ids].sort()).toEqual(['c1', 'c3'])
  })

  it('空客户表 → 无可见案件', () => {
    expect(visibleCaseIds([{ id: 'c1', customer_id: 'x' }], {}).size).toBe(0)
  })
})
