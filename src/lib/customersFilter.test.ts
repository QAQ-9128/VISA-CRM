import { describe, expect, it } from 'vitest'
import {
  matchesCustomerFilter,
  matchesVisaFilter,
  customerFilterCount,
  customerSource,
  caseNumberMatchedCustomerIds,
  EMPTY_CUSTOMER_FILTER,
} from './customersFilter'
import type { CustomerFilter } from './customersFilter'
import type { Customer } from '../types/models'

const cust = (over: Partial<Customer>): Customer =>
  ({
    id: 'c1',
    full_name: '张三',
    client_source: null,
    sponsor_employer_id: null,
    referrer_id: null,
    is_starred: false,
    ...over,
  }) as Customer

const filter = (over: Partial<CustomerFilter>): CustomerFilter => ({ ...EMPTY_CUSTOMER_FILTER, ...over })

describe('caseNumberMatchedCustomerIds（按案件号搜客户）', () => {
  const cases = [
    { id: 'k1', case_number: '70193357', customer_id: 'cu1' },
    { id: 'k2', case_number: '12345678', customer_id: 'cu2' },
  ]
  const applicants = [{ case_id: 'k1', customer_id: 'cu3' }]

  it('部分匹配案件号 → 案件客户 + 全部参与人', () => {
    expect(caseNumberMatchedCustomerIds('7019', cases, applicants)).toEqual(new Set(['cu1', 'cu3']))
    expect(caseNumberMatchedCustomerIds('70193357', cases, applicants)).toEqual(new Set(['cu1', 'cu3']))
  })
  it('不匹配 / 空搜索 → 空集合（不影响原搜索）', () => {
    expect(caseNumberMatchedCustomerIds('9999', cases, applicants).size).toBe(0)
    expect(caseNumberMatchedCustomerIds('   ', cases, applicants).size).toBe(0)
  })
})

describe('customerSource', () => {
  it('空 / 非法 → unclassified；合法来源原样', () => {
    expect(customerSource(cust({ client_source: null }))).toBe('unclassified')
    expect(customerSource(cust({ client_source: '' }))).toBe('unclassified')
    expect(customerSource(cust({ client_source: 'weird' }))).toBe('unclassified')
    expect(customerSource(cust({ client_source: 'green' }))).toBe('green')
  })
})

describe('matchesCustomerFilter', () => {
  it('空筛选 → 全部命中', () => {
    expect(matchesCustomerFilter(cust({}), EMPTY_CUSTOMER_FILTER)).toBe(true)
  })

  it('只看星标', () => {
    expect(matchesCustomerFilter(cust({ is_starred: false }), filter({ starredOnly: true }))).toBe(false)
    expect(matchesCustomerFilter(cust({ is_starred: true }), filter({ starredOnly: true }))).toBe(true)
  })

  it('按来源（含未分类）', () => {
    const f = filter({ sources: new Set(['green', 'unclassified']) })
    expect(matchesCustomerFilter(cust({ client_source: 'green' }), f)).toBe(true)
    expect(matchesCustomerFilter(cust({ client_source: null }), f)).toBe(true)
    expect(matchesCustomerFilter(cust({ client_source: 'red' }), f)).toBe(false)
  })

  it('按客户归属人（owner_referrer_id）；无归属被排除', () => {
    expect(matchesCustomerFilter(cust({ owner_referrer_id: 'o1' }), filter({ ownerIds: new Set(['o1']) }))).toBe(true)
    expect(matchesCustomerFilter(cust({ owner_referrer_id: 'o2' }), filter({ ownerIds: new Set(['o1']) }))).toBe(false)
    expect(matchesCustomerFilter(cust({ owner_referrer_id: null }), filter({ ownerIds: new Set(['o1']) }))).toBe(false)
  })

  it('担保雇主 / 介绍人不再是筛选维度（数据字段不影响命中）', () => {
    // 即使客户带这两个字段，空筛选下照常命中——它们不再参与过滤
    expect(matchesCustomerFilter(cust({ sponsor_employer_id: 'e1', referrer_id: 'r1' }), EMPTY_CUSTOMER_FILTER)).toBe(true)
  })

  it('跨维度为「且」', () => {
    const f = filter({ sources: new Set(['green']), starredOnly: true })
    expect(matchesCustomerFilter(cust({ client_source: 'green', is_starred: true }), f)).toBe(true)
    expect(matchesCustomerFilter(cust({ client_source: 'green', is_starred: false }), f)).toBe(false)
  })
})

describe('matchesVisaFilter（按案件签证类别）', () => {
  it('空集 → 不限', () => {
    expect(matchesVisaFilter(filter({}), ['482'])).toBe(true)
    expect(matchesVisaFilter(filter({}), [])).toBe(true)
  })
  it('有选 → 客户/卡片签证集与之有交集才命中', () => {
    const f = filter({ subclasses: new Set(['482']) })
    expect(matchesVisaFilter(f, ['482', '186'])).toBe(true)
    expect(matchesVisaFilter(f, ['186'])).toBe(false)
    expect(matchesVisaFilter(f, [])).toBe(false) // 无案件 → 不命中
  })
})

describe('customerFilterCount', () => {
  it('累计各维度已选数 + 星标开关（含签证 / 归属人）', () => {
    expect(customerFilterCount(EMPTY_CUSTOMER_FILTER)).toBe(0)
    expect(
      customerFilterCount(
        filter({ sources: new Set(['green', 'red']), ownerIds: new Set(['o1']), subclasses: new Set(['482']), starredOnly: true }),
      ),
    ).toBe(5)
  })
})
