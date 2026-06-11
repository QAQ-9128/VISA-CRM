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
    nomApproved: false,
    visaGranted: false,
    nomStatus: 'pending',
    visaStatus: null,
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
  it('补齐雇主名 / 介绍人名 / 客户归属人 / stream / 紧急(未决且超 DHA)', () => {
    const rows = selectCaseListRows(
      [caseRow({ caseId: 'c1', nomDaysSince: 130, nomDhaDays: 120 })], // 130 > 120 → 超期
      [kase({ id: 'c1', customer_id: 'cu1', visa_stream: 'Core Skills' })],
      [customer({ id: 'cu1', full_name: '张伟', sponsor_employer_id: 'e1', referrer_id: 'r1', owner_referrer_id: 'o1' })],
      [employer('e1', '金煌餐饮集团')],
      [referrer('r1', '林老师'), referrer('o1', '王老板')],
    )
    expect(rows[0]).toMatchObject({
      caseId: 'c1',
      customerName: '张伟',
      participantsLabel: '张伟', // 单参与人 → 只写一个名
      stream: 'Core Skills',
      visaSubclass: '482',
      employerId: 'e1',
      employerName: '金煌餐饮集团',
      referrerId: 'r1',
      referrerName: '林老师',
      ownerId: 'o1',
      ownerName: '王老板', // 客户归属人（owner_referrer_id，与介绍人同表 kind=owner）
      urgent: true,
    })
  })

  it('客户无归属人 → ownerId null / ownerName 空串', () => {
    const rows = selectCaseListRows(
      [caseRow({ caseId: 'c1' })],
      [kase({ id: 'c1' })],
      [customer({ id: 'cu1', owner_referrer_id: null })],
      [],
    )
    expect(rows[0].ownerId).toBeNull()
    expect(rows[0].ownerName).toBe('')
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

  it('投影案件大类：case_category 有值带出，null/缺失 → 空串', () => {
    const rows = selectCaseListRows(
      [caseRow({ caseId: 'c1' }), caseRow({ caseId: 'c2' })],
      [kase({ id: 'c1', case_category: '职业评估' }), kase({ id: 'c2', case_category: null })],
      [customer({ id: 'cu1' })],
      [],
    )
    expect(rows[0].caseCategory).toBe('职业评估')
    expect(rows[1].caseCategory).toBe('')
  })
})

describe('filterCaseListRows', () => {
  const rows: CaseListRow[] = [
    { caseId: 'c1', caseNumber: 'AA1', groupCode: 'G-0001', customerId: 'cu1', customerName: '张伟', participantsLabel: '张伟', stream: 'Core Skills', visaSubclass: '482', caseCategory: '签证申请', employerId: 'e1', employerName: '金煌餐饮', referrerId: 'r1', referrerName: '林老师', ownerId: 'o1', ownerName: '王老板', stage: 'nomination_lodged', updatedAt: '2025-05-01', urgent: false },
    { caseId: 'c2', caseNumber: 'BB2', groupCode: 'G-0002', customerId: 'cu2', customerName: '王强', participantsLabel: '王强、刘梅', stream: 'Direct Entry', visaSubclass: '186', caseCategory: '职业评估', employerId: 'e2', employerName: '澳信科技', referrerId: 'r2', referrerName: '陈姐', ownerId: 'o2', ownerName: '李老板', stage: 'granted', updatedAt: '2025-04-01', urgent: false },
    { caseId: 'c3', caseNumber: 'CC3', groupCode: 'G-0003', customerId: 'cu3', customerName: '陈静', participantsLabel: '陈静', stream: '', visaSubclass: '500', caseCategory: '', employerId: null, employerName: '', referrerId: null, referrerName: '', ownerId: null, ownerName: '', stage: 'docs_requested', updatedAt: '2025-03-01', urgent: true },
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

  it('按客户归属人筛（同维度或）；无归属的行被排除', () => {
    const out = filterCaseListRows(rows, { ...EMPTY_FILTER, ownerIds: new Set(['o1']) })
    expect(out.map((r) => r.caseId)).toEqual(['c1'])
    const both = filterCaseListRows(rows, { ...EMPTY_FILTER, ownerIds: new Set(['o1', 'o2']) })
    expect(both.map((r) => r.caseId)).toEqual(['c1', 'c2']) // c3 无归属 → 排除
  })

  it('担保雇主 / 介绍人 不再是筛选维度（筛选器上已无这两个键）', () => {
    expect('employerIds' in EMPTY_FILTER).toBe(false)
    expect('referrerIds' in EMPTY_FILTER).toBe(false)
    expect('ownerIds' in EMPTY_FILTER).toBe(true)
  })

  it('搜索匹配介绍人名', () => {
    expect(filterCaseListRows(rows, { ...EMPTY_FILTER, search: '林老师' }).map((r) => r.caseId)).toEqual(['c1'])
  })

  it('搜索匹配客户归属人名（归属人是主筛选维度，搜索框也要能直达）', () => {
    expect(filterCaseListRows(rows, { ...EMPTY_FILTER, search: '王老板' }).map((r) => r.caseId)).toEqual(['c1'])
    expect(filterCaseListRows(rows, { ...EMPTY_FILTER, search: '李老板' }).map((r) => r.caseId)).toEqual(['c2'])
  })

  it('搜索匹配参与人名 / 雇主 / 子类别 / 案件编号（大小写不敏感）', () => {
    expect(filterCaseListRows(rows, { ...EMPTY_FILTER, search: '王强' }).map((r) => r.caseId)).toEqual(['c2'])
    expect(filterCaseListRows(rows, { ...EMPTY_FILTER, search: '刘梅' }).map((r) => r.caseId)).toEqual(['c2']) // 同案参与人也可搜
    expect(filterCaseListRows(rows, { ...EMPTY_FILTER, search: '澳信' }).map((r) => r.caseId)).toEqual(['c2'])
    expect(filterCaseListRows(rows, { ...EMPTY_FILTER, search: 'Direct' }).map((r) => r.caseId)).toEqual(['c2']) // 子类别(stream)可搜
    expect(filterCaseListRows(rows, { ...EMPTY_FILTER, search: 'cc3' }).map((r) => r.caseId)).toEqual(['c3'])
  })

  it('搜索匹配案件大类（case_category）', () => {
    expect(filterCaseListRows(rows, { ...EMPTY_FILTER, search: '职业评估' }).map((r) => r.caseId)).toEqual(['c2'])
  })

  it('按案件大类筛（同维度或）；未填大类的行被排除', () => {
    const out = filterCaseListRows(rows, { ...EMPTY_FILTER, categories: new Set(['签证申请']) })
    expect(out.map((r) => r.caseId)).toEqual(['c1'])
    const both = filterCaseListRows(rows, { ...EMPTY_FILTER, categories: new Set(['签证申请', '职业评估']) })
    expect(both.map((r) => r.caseId)).toEqual(['c1', 'c2']) // c3 未填 → 排除
  })

  it('案件大类与其它维度跨维度「且」组合', () => {
    const out = filterCaseListRows(rows, {
      ...EMPTY_FILTER,
      categories: new Set(['签证申请', '职业评估']),
      stages: new Set(['granted']),
    })
    expect(out.map((r) => r.caseId)).toEqual(['c2'])
  })
})

describe('caseListFacets', () => {
  it('收集出现过的阶段(按流程序)/子类别/归属人(去重排序)', () => {
    const rows: CaseListRow[] = [
      { caseId: 'c1', caseNumber: 'A', groupCode: 'G-0001', customerId: '1', customerName: 'x', participantsLabel: 'x', stream: '', visaSubclass: '186', caseCategory: '职业评估', employerId: 'e2', employerName: '乙', referrerId: 'r2', referrerName: '介乙', ownerId: 'o2', ownerName: '归乙', stage: 'visa_lodged', updatedAt: '', urgent: false },
      { caseId: 'c2', caseNumber: 'B', groupCode: 'G-0002', customerId: '2', customerName: 'y', participantsLabel: 'y', stream: '', visaSubclass: '482', caseCategory: '签证申请', employerId: 'e1', employerName: '甲', referrerId: 'r1', referrerName: '介甲', ownerId: 'o1', ownerName: '归甲', stage: 'todo', updatedAt: '', urgent: false },
      { caseId: 'c3', caseNumber: 'C', groupCode: 'G-0003', customerId: '3', customerName: 'z', participantsLabel: 'z', stream: '', visaSubclass: '482', caseCategory: '', employerId: 'e1', employerName: '甲', referrerId: 'r1', referrerName: '介甲', ownerId: 'o1', ownerName: '归甲', stage: 'todo', updatedAt: '', urgent: false },
    ]
    const f = caseListFacets(rows)
    expect(f.stages).toEqual(['todo', 'visa_lodged']) // 按 CASE_STAGES 顺序
    expect(f.subclasses).toEqual(['186', '482'])
    expect(f.categories).toEqual(['签证申请', '职业评估']) // 只列出现过的，按 CASE_CATEGORIES 枚举序
    expect(f.owners).toEqual([{ id: 'o1', name: '归甲' }, { id: 'o2', name: '归乙' }]) // 去重 + 按名排序
  })
})

describe('caseFilterFacets（阶段全列 · 签证只列已有 · 归属人=现有归属值 distinct）', () => {
  const listRow = (caseId: string, sub: string, cat = '', ownerId: string | null = null, ownerName = ''): CaseListRow => ({
    caseId, caseNumber: caseId, groupCode: 'G-0001', customerId: 'cu', customerName: 'x', participantsLabel: 'x', stream: '', visaSubclass: sub,
    caseCategory: cat, employerId: null, employerName: '', referrerId: null, referrerName: '', ownerId, ownerName,
    stage: 'todo', updatedAt: '', urgent: false,
  })

  it('签证类别只取案件里出现过的；归属人 = 行里出现过的归属值去重', () => {
    const f = caseFilterFacets([
      listRow('c1', '482', '', 'o1', '王老板'),
      listRow('c2', '186', '', 'o2', '李老板'),
      listRow('c3', '482', '', 'o1', '王老板'),
      listRow('c4', '500'), // 无归属 → 不产出选项
    ])
    expect(f.stages).toEqual([...CASE_STAGES]) // 阶段仍全列
    expect(f.subclasses).toEqual(['186', '482', '500']) // 只有出现过的、去重排序
    expect(f.owners).toEqual([{ id: 'o2', name: '李老板' }, { id: 'o1', name: '王老板' }]) // distinct + 按名排序
    // 担保雇主 / 介绍人不再是筛选维度
    expect('employers' in f).toBe(false)
    expect('referrers' in f).toBe(false)
  })

  it('案件大类只取出现过的，按枚举序去重；未填不产出选项', () => {
    const f = caseFilterFacets([
      listRow('c1', '482', '定制文件'), listRow('c2', '186', '签证申请'), listRow('c3', '482', ''), listRow('c4', '500', '签证申请'),
    ])
    expect(f.categories).toEqual(['签证申请', '定制文件'])
  })

  it('无案件 → 签证类别/归属人为空；阶段仍全列', () => {
    const f = caseFilterFacets([])
    expect(f.subclasses).toEqual([])
    expect(f.categories).toEqual([])
    expect(f.owners).toEqual([])
    expect(f.stages.length).toBe(CASE_STAGES.length)
  })
})
