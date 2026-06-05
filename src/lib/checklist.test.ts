import { describe, expect, it } from 'vitest'
import { selectVisibleChecklist, checklistSource } from './checklist'

const item = (id: string, customer_id: string | null = null, case_id: string | null = null) => ({
  id,
  customer_id,
  case_id,
})

describe('selectVisibleChecklist（归档隐藏）', () => {
  const customers = new Set(['cu1', 'cu2'])
  const cases = new Set(['ca1'])

  it('未关联项始终保留', () => {
    const out = selectVisibleChecklist([item('a')], customers, cases)
    expect(out.map((i) => i.id)).toEqual(['a'])
  })

  it('关联在册客户/案件 → 保留', () => {
    const out = selectVisibleChecklist([item('a', 'cu1'), item('b', null, 'ca1')], customers, cases)
    expect(out.map((i) => i.id)).toEqual(['a', 'b'])
  })

  it('关联客户已归档（不在册）→ 隐藏', () => {
    const out = selectVisibleChecklist([item('a', 'cuX'), item('b', 'cu1')], customers, cases)
    expect(out.map((i) => i.id)).toEqual(['b'])
  })

  it('关联案件已归档 → 隐藏（即使客户仍在册）', () => {
    const out = selectVisibleChecklist([item('a', 'cu1', 'caX')], customers, cases)
    expect(out).toHaveLength(0)
  })
})

describe('checklistSource（待办来源标签）', () => {
  const caseById = { ca1: { id: 'ca1', customer_id: 'cu1', visa_subclass: '482', visa_stream: 'Core Skills' } }
  const customerById = { cu1: { id: 'cu1', full_name: '张伟' } }

  it('关联案件 → 客户名 · 签证，链到客户详情并带 case 参数（案件详情路由已删）', () => {
    const s = checklistSource({ customer_id: null, case_id: 'ca1' }, caseById, customerById)
    expect(s).toEqual({ kind: 'case', to: '/customers/cu1?case=ca1', label: '张伟 · 482/Core Skills' })
  })
  it('关联客户 → 客户名，链到客户', () => {
    const s = checklistSource({ customer_id: 'cu1', case_id: null }, caseById, customerById)
    expect(s).toEqual({ kind: 'customer', to: '/customers/cu1', label: '张伟' })
  })
  it('不关联 → 随手记（loose）', () => {
    expect(checklistSource({ customer_id: null, case_id: null }, caseById, customerById)).toEqual({ kind: 'loose' })
  })
  it('关联了但对象不在册/已归档 → unresolved（不显示标签、不造假）', () => {
    expect(checklistSource({ customer_id: 'gone', case_id: null }, caseById, customerById)).toEqual({ kind: 'unresolved' })
    expect(checklistSource({ customer_id: null, case_id: 'gone' }, caseById, customerById)).toEqual({ kind: 'unresolved' })
  })
})
