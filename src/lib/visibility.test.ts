import { describe, expect, it } from 'vitest'
import { visibleCaseIds } from './visibility'

describe('visibleCaseIds（一案一组：任一参与人在册即可见）', () => {
  it('案件客户在册 → 可见；客户归档且无其他在册参与人 → 隐藏', () => {
    const cases = [
      { id: 'c1', customer_id: 'active1' },
      { id: 'c2', customer_id: 'archivedOrGone' },
      { id: 'c3', customer_id: 'active2' },
    ]
    const customerById = { active1: { id: 'active1' }, active2: { id: 'active2' } }
    const ids = visibleCaseIds(cases, customerById)
    expect([...ids].sort()).toEqual(['c1', 'c3'])
  })

  it('案件客户已归档，但仍有在册参与人 → 案件可见（参与人平级，不因 owner 归档而消失）', () => {
    const cases = [{ id: 'c1', customer_id: 'archivedOwner' }]
    const customerById = { activeP: { id: 'activeP' } }
    const applicants = [{ case_id: 'c1', customer_id: 'activeP' }]
    expect(visibleCaseIds(cases, customerById, applicants).has('c1')).toBe(true)
  })

  it('案件客户与全部参与人都归档 → 隐藏', () => {
    const cases = [{ id: 'c1', customer_id: 'archivedOwner' }]
    const applicants = [{ case_id: 'c1', customer_id: 'archivedP' }]
    expect(visibleCaseIds(cases, {}, applicants).size).toBe(0)
  })

  it('参与人在册但属于别的案件 → 不影响本案', () => {
    const cases = [{ id: 'c1', customer_id: 'gone' }]
    const customerById = { activeP: { id: 'activeP' } }
    const applicants = [{ case_id: 'OTHER', customer_id: 'activeP' }]
    expect(visibleCaseIds(cases, customerById, applicants).size).toBe(0)
  })

  it('空客户表 + 无参与人 → 无可见案件', () => {
    expect(visibleCaseIds([{ id: 'c1', customer_id: 'x' }], {}).size).toBe(0)
  })
})
