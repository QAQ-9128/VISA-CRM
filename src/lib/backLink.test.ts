import { describe, expect, it } from 'vitest'
import { canGoBackInApp, deriveBackSource, resolveBackLink } from './backLink'

describe('canGoBackInApp（应用内是否可真·后退）', () => {
  it('history.state.idx > 0 → 可后退（后退一定还在应用内）', () => {
    expect(canGoBackInApp({ idx: 1 })).toBe(true)
    expect(canGoBackInApp({ idx: 7 })).toBe(true)
  })
  it('首条(idx=0)/缺 idx/null → 不可后退（走 fallback，避免退出应用）', () => {
    expect(canGoBackInApp({ idx: 0 })).toBe(false)
    expect(canGoBackInApp({})).toBe(false)
    expect(canGoBackInApp(null)).toBe(false)
    expect(canGoBackInApp({ idx: 'x' })).toBe(false)
  })
})

const FALLBACK = { to: '/customers', label: '返回客户' }

describe('deriveBackSource（按路由推导来源）', () => {
  it('固定区域', () => {
    expect(deriveBackSource('/')).toEqual({ from: 'dashboard' })
    expect(deriveBackSource('/customers')).toEqual({ from: 'customers' })
    expect(deriveBackSource('/finance')).toEqual({ from: 'finance' })
    expect(deriveBackSource('/storage')).toEqual({ from: 'archive' })
    expect(deriveBackSource('/employers')).toEqual({ from: 'employers' })
    expect(deriveBackSource('/referrers')).toEqual({ from: 'referrers' })
  })
  it('案件区按 tab', () => {
    expect(deriveBackSource('/cases')).toEqual({ from: 'cases' })
    expect(deriveBackSource('/cases', '?view=lodge')).toEqual({ from: 'cases', view: 'lodge' })
  })
  it('详情页 → 带 id 的来源', () => {
    expect(deriveBackSource('/customers/cu1')).toEqual({ from: 'customer', customerId: 'cu1' })
    expect(deriveBackSource('/cases/ca1')).toEqual({ from: 'case', caseId: 'ca1' })
  })
  it('未知路由 → 空（详情页回落 fallback）', () => {
    expect(deriveBackSource('/whatever')).toEqual({})
  })
})

describe('resolveBackLink（来源 → 返回目标）', () => {
  it('概览 / 财务 / 客户 / 档案库', () => {
    expect(resolveBackLink({ from: 'dashboard' }, FALLBACK)).toEqual({ to: '/', label: '返回概览' })
    expect(resolveBackLink({ from: 'finance' }, FALLBACK)).toEqual({ to: '/finance', label: '返回财务' })
    expect(resolveBackLink({ from: 'customers' }, FALLBACK)).toEqual({ to: '/customers', label: '返回客户列表' })
    expect(resolveBackLink({ from: 'archive' }, FALLBACK)).toEqual({ to: '/storage', label: '返回档案库' })
  })
  it('案件区按 tab', () => {
    expect(resolveBackLink({ from: 'cases' }, FALLBACK)).toEqual({ to: '/cases', label: '返回案件' })
    expect(resolveBackLink({ from: 'cases', view: 'lodge' }, FALLBACK)).toEqual({ to: '/cases?view=lodge', label: '返回递交进度' })
  })
  it('来自具体客户/案件详情 → 回到该详情', () => {
    expect(resolveBackLink({ from: 'customer', customerId: 'cu1' }, FALLBACK)).toEqual({ to: '/customers/cu1', label: '返回客户档案' })
    expect(resolveBackLink({ from: 'case', caseId: 'ca1' }, FALLBACK)).toEqual({ to: '/cases/ca1', label: '返回案件' })
  })
  it('缺 id / 未知 / 空 → fallback', () => {
    expect(resolveBackLink({ from: 'customer' }, FALLBACK)).toEqual(FALLBACK)
    expect(resolveBackLink({ from: 'nope' }, FALLBACK)).toEqual(FALLBACK)
    expect(resolveBackLink(null, FALLBACK)).toEqual(FALLBACK)
    expect(resolveBackLink(undefined, FALLBACK)).toEqual(FALLBACK)
  })
})
