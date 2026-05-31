import { describe, expect, it } from 'vitest'
import { resolveCaseBackLink } from './caseBackLink'

const CASE_CUSTOMER = 'cust-db' // case row 自带的 customer_id（NOT NULL 外键，永远可兜底）

describe('resolveCaseBackLink', () => {
  it("from 'customer' + customerId → 返回客户档案，跳该客户", () => {
    expect(resolveCaseBackLink({ from: 'customer', customerId: 'cu1' }, CASE_CUSTOMER)).toEqual({
      to: '/customers/cu1',
      label: '返回客户档案',
    })
  })
  it("from 'cases' → 递交进度 /cases", () => {
    expect(resolveCaseBackLink({ from: 'cases' }, CASE_CUSTOMER)).toEqual({ to: '/cases', label: '递交进度' })
  })
  it("from 'dashboard' → 返回仪表板 /", () => {
    expect(resolveCaseBackLink({ from: 'dashboard' }, CASE_CUSTOMER)).toEqual({ to: '/', label: '返回仪表板' })
  })
  it("from 'finance' → 返回财务 /finance", () => {
    expect(resolveCaseBackLink({ from: 'finance' }, CASE_CUSTOMER)).toEqual({ to: '/finance', label: '返回财务' })
  })
  it("from 'archive' → 返回档案库 /storage", () => {
    expect(resolveCaseBackLink({ from: 'archive' }, CASE_CUSTOMER)).toEqual({ to: '/storage', label: '返回档案库' })
  })

  // ── 兜底：永远有可点的返回按钮，永远指向存在的 URL（case.customer_id） ──
  it('state 完全缺失（刷新/直接URL/新标签）→ 回落到该案件的客户档案', () => {
    expect(resolveCaseBackLink(undefined, CASE_CUSTOMER)).toEqual({
      to: '/customers/cust-db',
      label: '返回客户档案',
    })
    expect(resolveCaseBackLink(null, CASE_CUSTOMER)).toEqual({ to: '/customers/cust-db', label: '返回客户档案' })
  })
  it('from 未知值（防御性）→ 回落到客户档案', () => {
    expect(resolveCaseBackLink({ from: 'whatever' }, CASE_CUSTOMER)).toEqual({
      to: '/customers/cust-db',
      label: '返回客户档案',
    })
  })
  it("from 'customer' 但缺 customerId（防御性）→ 回落到 case.customer_id", () => {
    expect(resolveCaseBackLink({ from: 'customer' }, CASE_CUSTOMER)).toEqual({
      to: '/customers/cust-db',
      label: '返回客户档案',
    })
  })
})
