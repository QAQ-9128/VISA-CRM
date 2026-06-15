import { describe, expect, it } from 'vitest'
import {
  selectCaseCards,
  matchesCaseSearch,
  matchesCaseFilter,
  caseSponsorVisible,
  caseVisaLabel,
  EMPTY_CASE_BOARD_FILTER,
} from './caseBoard'
import type { Case, CaseApplicant, Customer } from '../types/models'

const mkCust = (o: Partial<Customer>): Customer => ({
  id: 'c1', full_name: '甲', chinese_name: null, english_name: null, birth_date: null, gender: null,
  passport_no: null, nationality: null, phone: null, email: null, wechat: null, address: null,
  sponsor_employer_id: null, sponsor_position: null, referrer_id: null, owner_referrer_id: null,
  primary_applicant_id: null, relationship_to_primary: null, client_source: null, is_starred: false,
  notes: null, assigned_to: null, created_by: null, is_archived: false, created_at: '', updated_at: '', ...o,
})
const mkCase = (o: Partial<Case>): Case => ({
  id: 'ca1', case_number: 'CASE-2026-001', customer_id: 'P', visa_subclass: '482', visa_stream: 'Core Skills',
  case_category: null, case_details: null, destination_country: null, sponsor_position: null, sponsor_employer_id: null,
  immi_account_id: null, current_stage: 'nomination_lodged', currency: 'AUD', sync_tracking: true,
  trt_reminder_enabled: false, trt_reminder_dismissed: false, cohab_reminder_enabled: false, cohab_reminder_last: null,
  parent_case_id: null, parent_sync_progress: false, assigned_to: null, created_by: null, is_archived: false,
  created_at: '', updated_at: '', ...o,
})
const mkAppl = (case_id: string, customer_id: string): CaseApplicant => ({ id: `${case_id}-${customer_id}`, case_id, customer_id, created_at: '' })
const byId = (list: Customer[]) => Object.fromEntries(list.map((c) => [c.id, c]))

describe('caseSponsorVisible（仅担保类型显示职位/雇主）', () => {
  it('482/482sbs/186/407 → true', () => {
    expect(caseSponsorVisible('482', 'Core Skills')).toBe(true)
    expect(caseSponsorVisible('SBS', null)).toBe(true)
    expect(caseSponsorVisible('186', 'Temporary Residence Transition')).toBe(true)
    expect(caseSponsorVisible('407', null)).toBe(true)
  })
  it('485/600/500/配偶/De Facto/定制 → false', () => {
    for (const s of ['485', '600', '500', '590', '820/801', '309/100', 'De Facto', '定制文件', 'Skill Assessment']) {
      expect(caseSponsorVisible(s, null)).toBe(false)
    }
  })
  it('482 副申（Secondary Applicant）→ false（无自己的担保）', () => {
    expect(caseSponsorVisible('482', 'Secondary Applicant')).toBe(false)
  })
})

describe('caseVisaLabel', () => {
  it('干净短标签；186 带 Stream 简写', () => {
    expect(caseVisaLabel('482', 'Core Skills')).toBe('482 TSS')
    expect(caseVisaLabel('SBS', null)).toBe('482 SBS')
    expect(caseVisaLabel('186', 'Temporary Residence Transition')).toBe('186 ENS（TRT）')
    expect(caseVisaLabel('485', null)).toBe('485 毕业生工签')
    expect(caseVisaLabel('309/100', null)).toBe('配偶签证 PR（309/100）')
  })
})

describe('selectCaseCards', () => {
  const customers = [
    mkCust({ id: 'P', chinese_name: '陈伟', english_name: 'CHEN Wei', owner_referrer_id: 'own1' }),
    mkCust({ id: 'S', chinese_name: '林陆', english_name: 'LIN Lu', relationship_to_primary: '配偶', owner_referrer_id: 'own2' }),
  ]
  const employerNameById = { e1: 'Golden Wok Pty Ltd' }

  it('担保类型案件：含职位 + 担保雇主；参与人主申无后缀、副申带「· 关系」、中文名优先', () => {
    const c = mkCase({ id: 'ca1', customer_id: 'P', visa_subclass: '482', sponsor_position: 'Cook（厨师）ANZSCO 351111', sponsor_employer_id: 'e1' })
    const [vm] = selectCaseCards([c], byId(customers), [mkAppl('ca1', 'S')], employerNameById)
    expect(vm.visaLabel).toBe('482 TSS')
    expect(vm.position).toBe('Cook（厨师）ANZSCO 351111')
    expect(vm.employerName).toBe('Golden Wok Pty Ltd')
    expect(vm.participants).toEqual([
      { id: 'P', name: '陈伟', relationship: null },
      { id: 'S', name: '林陆', relationship: '配偶' },
    ])
    expect(vm.subtitle).toBe('陈伟')
    expect(new Set(vm.ownerIds)).toEqual(new Set(['own1', 'own2']))
  })

  it('非担保类型案件：position / employerName 均为 null（不渲染担保行的数据源）', () => {
    const c = mkCase({ id: 'ca2', customer_id: 'P', visa_subclass: '485', visa_stream: 'Post-Study Work', sponsor_position: '不该显示', sponsor_employer_id: 'e1' })
    const [vm] = selectCaseCards([c], byId(customers), [], employerNameById)
    expect(vm.position).toBeNull()
    expect(vm.employerName).toBeNull()
    expect(vm.visaLabel).toBe('485 毕业生工签')
  })

  it('担保类型但无担保数据：position / employerName 为 null（不编空占位）', () => {
    const c = mkCase({ id: 'ca3', customer_id: 'P', visa_subclass: '482', sponsor_position: null, sponsor_employer_id: null })
    const [vm] = selectCaseCards([c], byId(customers), [], employerNameById)
    expect(vm.position).toBeNull()
    expect(vm.employerName).toBeNull()
  })
})

describe('matchesCaseSearch（案件号 / 参与人中英 / 雇主 / 职位）', () => {
  const customers = [
    mkCust({ id: 'P', chinese_name: '陈伟', english_name: 'CHEN Wei' }),
    mkCust({ id: 'S', chinese_name: '林陆', english_name: 'LIN Lu', relationship_to_primary: '配偶' }),
  ]
  const c = mkCase({ id: 'ca1', case_number: 'CASE-2026-014', customer_id: 'P', visa_subclass: '482', sponsor_position: 'Cook 厨师', sponsor_employer_id: 'e1' })
  const [vm] = selectCaseCards([c], byId(customers), [mkAppl('ca1', 'S')], { e1: 'Golden Wok Pty Ltd' })

  it('命中各字段', () => {
    expect(matchesCaseSearch(vm, '2026-014')).toBe(true) // 案件号
    expect(matchesCaseSearch(vm, '陈伟')).toBe(true) // 参与人中文
    expect(matchesCaseSearch(vm, 'lin lu')).toBe(true) // 参与人英文（小写不敏感）
    expect(matchesCaseSearch(vm, 'golden wok')).toBe(true) // 雇主
    expect(matchesCaseSearch(vm, 'cook')).toBe(true) // 职位
    expect(matchesCaseSearch(vm, '')).toBe(true) // 空 → 全命中
  })
  it('不相关词不命中', () => {
    expect(matchesCaseSearch(vm, '李四')).toBe(false)
  })
})

describe('matchesCaseFilter（签证类别 / 担保雇主 / 客户归属人=任一参与人归属）', () => {
  const customers = [
    mkCust({ id: 'P', chinese_name: '陈伟', owner_referrer_id: 'own1' }),
    mkCust({ id: 'S', chinese_name: '林陆', owner_referrer_id: 'own2' }),
  ]
  const c = mkCase({ id: 'ca1', customer_id: 'P', visa_subclass: '482', sponsor_employer_id: 'e1' })
  const [vm] = selectCaseCards([c], byId(customers), [mkAppl('ca1', 'S')], { e1: 'Golden Wok Pty Ltd' })

  it('签证类别', () => {
    expect(matchesCaseFilter(vm, { ...EMPTY_CASE_BOARD_FILTER, subclasses: new Set(['482']) })).toBe(true)
    expect(matchesCaseFilter(vm, { ...EMPTY_CASE_BOARD_FILTER, subclasses: new Set(['485']) })).toBe(false)
  })
  it('担保雇主', () => {
    expect(matchesCaseFilter(vm, { ...EMPTY_CASE_BOARD_FILTER, employerIds: new Set(['e1']) })).toBe(true)
    expect(matchesCaseFilter(vm, { ...EMPTY_CASE_BOARD_FILTER, employerIds: new Set(['e2']) })).toBe(false)
  })
  it('客户归属人 = 任一参与人归属命中（副申 own2 命中）', () => {
    expect(matchesCaseFilter(vm, { ...EMPTY_CASE_BOARD_FILTER, ownerIds: new Set(['own2']) })).toBe(true)
    expect(matchesCaseFilter(vm, { ...EMPTY_CASE_BOARD_FILTER, ownerIds: new Set(['own1']) })).toBe(true)
    expect(matchesCaseFilter(vm, { ...EMPTY_CASE_BOARD_FILTER, ownerIds: new Set(['own9']) })).toBe(false)
  })
  it('空筛选 → 全命中', () => {
    expect(matchesCaseFilter(vm, EMPTY_CASE_BOARD_FILTER)).toBe(true)
  })
})
