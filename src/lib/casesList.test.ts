import { describe, expect, it } from 'vitest'
import {
  selectCaseListRows,
  filterCaseListRows,
  caseListFacets,
  caseFilterFacets,
  EMPTY_FILTER,
} from './casesList'
import { CASE_STAGES } from '../types/domain'
import type { CaseListRow } from './casesList'
import type { CaseRow } from './casesTable'
import type { Case, Customer, Employer, Referrer } from '../types/models'

// 最小 CaseRow 工厂（只填本模块用到的字段）
function caseRow(over: Partial<CaseRow> & Pick<CaseRow, 'caseId'>): CaseRow {
  return {
    rowKey: over.caseId,
    caseNumber: 'C0001',
    groupCode: 'G-AB12',
    role: 'merged',
    primaryName: '张伟',
    primaryCustomerId: 'cust-1',
    secondaryName: '',
    secondaryCustomerIds: [],
    visaLabel: '482/Core Skills',
    visaSubclass: '482',
    currentStage: 'nomination_lodged',
    lodged: true,
    nomLodgedDate: '2025-01-01',
    visaLodgedDate: null,
    daysSince: 100,
    elapsed: { months: 3, days: 10 },
    nomDaysSince: 100,
    nomElapsed: { months: 3, days: 10 },
    visaDaysSince: null,
    visaElapsed: null,
    frozen: false,
    nomDhaDays: 120,
    visaDhaDays: null,
    updatedAt: '2025-05-01',
    ...over,
  }
}

const customer = (over: Partial<Customer> & Pick<Customer, 'id'>): Customer =>
  ({ full_name: '张伟', sponsor_employer_id: null, referrer_id: null, visa_stream: null, ...over }) as Customer
const kase = (over: Partial<Case> & Pick<Case, 'id'>): Case =>
  ({ customer_id: 'cu1', visa_subclass: '482', visa_stream: 'Core Skills', ...over }) as Case
const employer = (id: string, name: string): Employer => ({ id, name }) as Employer
const referrer = (id: string, name: string): Referrer => ({ id, name }) as Referrer

describe('selectCaseListRows', () => {
  it('补齐雇主名 / 介绍人名 / 签证大类 / stream / 紧急(未决且超 DHA)', () => {
    const rows = selectCaseListRows(
      [caseRow({ caseId: 'c1', nomDaysSince: 130, nomDhaDays: 120 })], // 130 > 120 → 超期
      [kase({ id: 'c1', customer_id: 'cu1', visa_stream: 'Core Skills' })],
      [customer({ id: 'cu1', full_name: '张伟', sponsor_employer_id: 'e1', referrer_id: 'r1' })],
      [employer('e1', '金煌餐饮集团')],
      [referrer('r1', '林老师')],
    )
    expect(rows[0]).toMatchObject({
      caseId: 'c1',
      customerName: '张伟',
      participantsLabel: '张伟', // 单参与人 → 只写一个名
      stream: 'Core Skills',
      visaSubclass: '482',
      visaCategory: '工作 / 雇主担保',
      employerId: 'e1',
      employerName: '金煌餐饮集团',
      referrerId: 'r1',
      referrerName: '林老师',
      urgent: true,
    })
  })

  it('多参与人 → participantsLabel 拼接案件客户 + 同案参与客户', () => {
    const rows = selectCaseListRows(
      [caseRow({ caseId: 'c1', primaryName: '张伟', secondaryName: '李娜、王芳', secondaryCustomerIds: ['cu2', 'cu3'] })],
      [kase({ id: 'c1' })],
      [customer({ id: 'cu1' })],
      [],
    )
    expect(rows[0].participantsLabel).toBe('张伟、李娜、王芳')
  })

  it('已决(frozen)即使超 DHA 也不算紧急', () => {
    const rows = selectCaseListRows(
      [caseRow({ caseId: 'c1', frozen: true, nomDaysSince: 999, nomDhaDays: 120, currentStage: 'granted' })],
      [kase({ id: 'c1' })],
      [customer({ id: 'cu1' })],
      [],
    )
    expect(rows[0].urgent).toBe(false)
  })

  it('未超 DHA → 不紧急；无雇主 → 空名', () => {
    const rows = selectCaseListRows(
      [caseRow({ caseId: 'c1', nomDaysSince: 30, nomDhaDays: 120 })],
      [kase({ id: 'c1' })],
      [customer({ id: 'cu1', sponsor_employer_id: null })],
      [],
    )
    expect(rows[0].urgent).toBe(false)
    expect(rows[0].employerId).toBeNull()
    expect(rows[0].employerName).toBe('')
  })
})

describe('filterCaseListRows', () => {
  const rows: CaseListRow[] = [
    { caseId: 'c1', caseNumber: 'AA1', groupCode: 'G-0001', customerId: 'cu1', customerName: '张伟', participantsLabel: '张伟', stream: 'Core Skills', visaSubclass: '482', visaCategory: '工作 / 雇主担保', employerId: 'e1', employerName: '金煌餐饮', referrerId: 'r1', referrerName: '林老师', stage: 'nomination_lodged', updatedAt: '2025-05-01', urgent: false },
    { caseId: 'c2', caseNumber: 'BB2', groupCode: 'G-0002', customerId: 'cu2', customerName: '王强', participantsLabel: '王强、刘梅', stream: 'Direct Entry', visaSubclass: '186', visaCategory: '工作 / 雇主担保', employerId: 'e2', employerName: '澳信科技', referrerId: 'r2', referrerName: '陈姐', stage: 'granted', updatedAt: '2025-04-01', urgent: false },
    { caseId: 'c3', caseNumber: 'CC3', groupCode: 'G-0003', customerId: 'cu3', customerName: '陈静', participantsLabel: '陈静', stream: '', visaSubclass: '500', visaCategory: '学生 / 毕业生', employerId: null, employerName: '', referrerId: null, referrerName: '', stage: 'docs_requested', updatedAt: '2025-03-01', urgent: true },
  ]

  it('空筛选 = 原样返回', () => {
    expect(filterCaseListRows(rows, EMPTY_FILTER)).toHaveLength(3)
  })

  it('只看进行中 → 排除终态(granted)', () => {
    const out = filterCaseListRows(rows, { ...EMPTY_FILTER, activeOnly: true })
    expect(out.map((r) => r.caseId)).toEqual(['c1', 'c3'])
  })

  it('按阶段(或) + 按子类别(且) 组合', () => {
    const out = filterCaseListRows(rows, {
      ...EMPTY_FILTER,
      stages: new Set(['nomination_lodged', 'docs_requested']),
      subclasses: new Set(['500']),
    })
    expect(out.map((r) => r.caseId)).toEqual(['c3']) // 阶段命中 c1/c3，再叠加 500 只剩 c3
  })

  it('按雇主筛；无雇主的行被排除', () => {
    const out = filterCaseListRows(rows, { ...EMPTY_FILTER, employerIds: new Set(['e1']) })
    expect(out.map((r) => r.caseId)).toEqual(['c1'])
  })

  it('按介绍人筛；无介绍人的行被排除', () => {
    const out = filterCaseListRows(rows, { ...EMPTY_FILTER, referrerIds: new Set(['r2']) })
    expect(out.map((r) => r.caseId)).toEqual(['c2'])
  })

  it('搜索匹配介绍人名', () => {
    expect(filterCaseListRows(rows, { ...EMPTY_FILTER, search: '林老师' }).map((r) => r.caseId)).toEqual(['c1'])
  })

  it('搜索匹配参与人名 / 雇主 / 大类 / 案件编号（大小写不敏感）', () => {
    expect(filterCaseListRows(rows, { ...EMPTY_FILTER, search: '王强' }).map((r) => r.caseId)).toEqual(['c2'])
    expect(filterCaseListRows(rows, { ...EMPTY_FILTER, search: '刘梅' }).map((r) => r.caseId)).toEqual(['c2']) // 同案参与人也可搜
    expect(filterCaseListRows(rows, { ...EMPTY_FILTER, search: '澳信' }).map((r) => r.caseId)).toEqual(['c2'])
    expect(filterCaseListRows(rows, { ...EMPTY_FILTER, search: '学生' }).map((r) => r.caseId)).toEqual(['c3'])
    expect(filterCaseListRows(rows, { ...EMPTY_FILTER, search: 'cc3' }).map((r) => r.caseId)).toEqual(['c3'])
  })
})

describe('caseListFacets', () => {
  it('收集出现过的阶段(按流程序)/子类别/雇主(去重排序)', () => {
    const rows: CaseListRow[] = [
      { caseId: 'c1', caseNumber: 'A', groupCode: 'G-0001', customerId: '1', customerName: 'x', participantsLabel: 'x', stream: '', visaSubclass: '186', visaCategory: '', employerId: 'e2', employerName: '乙', referrerId: 'r2', referrerName: '介乙', stage: 'visa_lodged', updatedAt: '', urgent: false },
      { caseId: 'c2', caseNumber: 'B', groupCode: 'G-0002', customerId: '2', customerName: 'y', participantsLabel: 'y', stream: '', visaSubclass: '482', visaCategory: '', employerId: 'e1', employerName: '甲', referrerId: 'r1', referrerName: '介甲', stage: 'todo', updatedAt: '', urgent: false },
      { caseId: 'c3', caseNumber: 'C', groupCode: 'G-0003', customerId: '3', customerName: 'z', participantsLabel: 'z', stream: '', visaSubclass: '482', visaCategory: '', employerId: 'e1', employerName: '甲', referrerId: 'r1', referrerName: '介甲', stage: 'todo', updatedAt: '', urgent: false },
    ]
    const f = caseListFacets(rows)
    expect(f.stages).toEqual(['todo', 'visa_lodged']) // 按 CASE_STAGES 顺序
    expect(f.subclasses).toEqual(['186', '482'])
    expect(f.employers).toEqual([{ id: 'e1', name: '甲' }, { id: 'e2', name: '乙' }])
    expect(f.referrers).toEqual([{ id: 'r1', name: '介甲' }, { id: 'r2', name: '介乙' }])
  })
})

describe('caseFilterFacets（阶段全列 · 签证只列已有 · 雇主/介绍人全集）', () => {
  const listRow = (caseId: string, sub: string): CaseListRow => ({
    caseId, caseNumber: caseId, groupCode: 'G-0001', customerId: 'cu', customerName: 'x', participantsLabel: 'x', stream: '', visaSubclass: sub,
    visaCategory: '', employerId: null, employerName: '', referrerId: null, referrerName: '',
    stage: 'todo', updatedAt: '', urgent: false,
  })

  it('签证类别只取案件里出现过的（没案件的不显示）', () => {
    const f = caseFilterFacets(
      [listRow('c1', '482'), listRow('c2', '186'), listRow('c3', '482')],
      [employer('e2', '乙公司'), employer('e1', '甲公司')],
      [referrer('r1', '林老师')],
    )
    expect(f.stages).toEqual([...CASE_STAGES]) // 阶段仍全列
    expect(f.subclasses).toEqual(['186', '482']) // 只有出现过的、去重排序
    expect(f.employers).toEqual([{ id: 'e1', name: '甲公司' }, { id: 'e2', name: '乙公司' }]) // 雇主全集
    expect(f.referrers).toEqual([{ id: 'r1', name: '林老师' }])
  })

  it('无案件 → 签证类别为空；雇主/介绍人仍按主数据全列', () => {
    const f = caseFilterFacets([], [employer('e1', '甲')], [])
    expect(f.subclasses).toEqual([])
    expect(f.employers).toEqual([{ id: 'e1', name: '甲' }])
    expect(f.stages.length).toBe(CASE_STAGES.length)
  })
})
