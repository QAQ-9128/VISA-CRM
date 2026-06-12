import { describe, expect, it } from 'vitest'
import { selectCustomerCaseLines, selectDisplayCases } from './customerList'
import type { Case, CaseApplicant } from '../types/models'

const mkCase = (o: Partial<Case>): Case => ({
  id: 'c1', case_number: '1', customer_id: 'cu1', visa_subclass: '186', visa_stream: 'Direct Entry', case_category: null, case_details: null,
  current_stage: 'visa_lodged', currency: 'AUD', sync_tracking: true, trt_reminder_enabled: false, trt_reminder_dismissed: false, cohab_reminder_enabled: false, cohab_reminder_last: null,
  parent_case_id: null, parent_sync_progress: false, destination_country: null, sponsor_position: null, sponsor_employer_id: null, immi_account_id: null, assigned_to: null, created_by: null, is_archived: false, created_at: '', updated_at: '', ...o,
})
const ca = (case_id: string, customer_id: string): CaseApplicant => ({
  id: `${case_id}-${customer_id}`, case_id, customer_id, created_at: '',
})

const cs = (o: Partial<Case>): Pick<Case, 'id' | 'visa_subclass' | 'visa_stream' | 'current_stage'> => ({
  id: 'c1', visa_subclass: '482', visa_stream: null, current_stage: 'visa_lodged', ...o,
})

describe('selectCustomerCaseLines（客户列表内联字段：签证 | 职位 | 担保雇主，状态徽章由 UI 追加）', () => {
  it('有职位没担保 → [签证, 职位]', () => {
    const r = selectCustomerCaseLines({ sponsor_position: 'Senior Cook' }, [cs({})], null)
    expect(r).toHaveLength(1)
    expect(r[0].fields).toEqual(['482', 'Senior Cook'])
    expect(r[0].stage).toBe('visa_lodged')
    expect(r[0].caseId).toBe('c1')
  })
  it('有担保没职位 → [签证, 担保雇主]', () => {
    const r = selectCustomerCaseLines({ sponsor_position: null }, [cs({})], 'ABC Pty Ltd')
    expect(r[0].fields).toEqual(['482', 'ABC Pty Ltd'])
  })
  it('都有 → [签证, 职位, 担保雇主]', () => {
    const r = selectCustomerCaseLines({ sponsor_position: 'Cook' }, [cs({})], 'ABC Pty Ltd')
    expect(r[0].fields).toEqual(['482', 'Cook', 'ABC Pty Ltd'])
  })
  it('都没 → 仅签证类型（配偶/学生等）', () => {
    const r = selectCustomerCaseLines({ sponsor_position: null }, [cs({ visa_subclass: '820/801' })], null)
    expect(r[0].fields).toEqual(['820/801'])
  })
  it('无案件 → 空数组（UI 显示"暂无案件"）', () => {
    expect(selectCustomerCaseLines({ sponsor_position: 'Cook' }, [], 'ABC')).toEqual([])
  })
  it('含子类别合并；纯空白职位/雇主视为未填、跳过', () => {
    const r = selectCustomerCaseLines(
      { sponsor_position: '   ' },
      [cs({ visa_subclass: '482', visa_stream: 'Core Skills' })],
      '  ',
    )
    expect(r[0].fields).toEqual(['482/Core Skills'])
  })
  it('多案件各成一行', () => {
    const r = selectCustomerCaseLines(
      { sponsor_position: 'Cook' },
      [cs({ id: 'a', visa_subclass: '482' }), cs({ id: 'b', visa_subclass: '186', current_stage: 'granted' })],
      'ABC',
    )
    expect(r.map((l) => l.caseId)).toEqual(['a', 'b'])
    expect(r[1].fields).toEqual(['186', 'Cook', 'ABC'])
    expect(r[1].stage).toBe('granted')
  })
})

describe('selectDisplayCases（列表行显示哪些案件：主申优先，否则副申参与的）', () => {
  it('只有自己作为主申的案件 → 显示主申案件', () => {
    const cases = [mkCase({ id: 'p', customer_id: 'cu1' })]
    expect(selectDisplayCases('cu1', cases, []).map((c) => c.id)).toEqual(['p'])
  })
  it('没主申、只作为副申参与某案件 → 显示那个案件（修复"暂无案件"bug）', () => {
    const cases = [mkCase({ id: 'x', customer_id: 'other' })] // 别人主申的案件
    const apps = [ca('x', 'cu1')]
    expect(selectDisplayCases('cu1', cases, apps).map((c) => c.id)).toEqual(['x'])
  })
  it('主申 + 副申都有 → 优先显示主申', () => {
    const cases = [mkCase({ id: 'p', customer_id: 'cu1' }), mkCase({ id: 'x', customer_id: 'other' })]
    const apps = [ca('x', 'cu1')]
    expect(selectDisplayCases('cu1', cases, apps).map((c) => c.id)).toEqual(['p'])
  })
  it('既无主申也无副申案件 → 空数组（UI 显示"暂无案件"）', () => {
    expect(selectDisplayCases('cu1', [mkCase({ id: 'x', customer_id: 'other' })], [])).toEqual([])
  })
})
