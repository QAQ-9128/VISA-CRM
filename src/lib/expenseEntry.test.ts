import { describe, expect, it } from 'vitest'
import {
  EXPENSE_PARTY_LABELS,
  actualAmount,
  actualFormula,
  draftToExpensePayment,
  emptyExpenseDraft,
  isExpenseDraftBlank,
  isExpenseDraftValid,
  payableItemToPayment,
  paymentToPayableItem,
  validateExpenseDrafts,
} from './expenseEntry'
import type { DraftExpenseLine } from './expenseEntry'
import { selectCaseExpenses } from './caseExpenses'
import type { Payment, PaymentPlanItem } from '../types/models'

const draft = (over: Partial<DraftExpenseLine>): DraftExpenseLine => ({
  key: 'k', party: '', method: '', amount: '', percent: '', ...over,
})

describe('expenseEntry — 支出列式 + 百分比实付', () => {
  it('付款对象显示名：付给公司 / 付给介绍人（底层 to_company/to_referrer）', () => {
    expect(EXPENSE_PARTY_LABELS.to_company).toBe('付给公司')
    expect(EXPENSE_PARTY_LABELS.to_referrer).toBe('付给介绍人')
  })

  it('★实付 = 金额 × 百分比；留空 = 100%', () => {
    expect(actualAmount('100', '30')).toBe(30) // 100×30%
    expect(actualAmount('100', '')).toBe(100) // 留空=100%
    expect(actualAmount('100', '  ')).toBe(100) // 空白=100%
    expect(actualAmount('250', '40')).toBe(100)
    expect(actualAmount('99.99', '50')).toBe(50) // round2
    expect(actualAmount('100', 'abc')).toBe(100) // 非法百分比→100%
  })

  it('算式展示：有百分比→100×30%；留空→100%', () => {
    expect(actualFormula('100', '30')).toBe('100×30%')
    expect(actualFormula('100', '')).toBe('100%')
  })

  it('空白行判定 / 合法行（付款对象+方式+金额>0）', () => {
    expect(isExpenseDraftBlank(draft({}))).toBe(true)
    expect(isExpenseDraftBlank(draft({ amount: '100' }))).toBe(false)
    expect(isExpenseDraftValid(draft({ party: 'to_company', method: 'cash', amount: '100' }))).toBe(true)
    expect(isExpenseDraftValid(draft({ party: '', method: 'cash', amount: '100' }))).toBe(false) // 缺对象
    expect(isExpenseDraftValid(draft({ party: 'to_company', method: '', amount: '100' }))).toBe(false) // 缺方式
    expect(isExpenseDraftValid(draft({ party: 'to_company', method: 'cash', amount: '0' }))).toBe(false) // 金额0
  })

  it('批量校验：空白忽略、半填拦截、全有效放行', () => {
    const blank = draft({ key: 'a' })
    const good = draft({ key: 'b', party: 'to_company', method: 'cash', amount: '100', percent: '30' })
    const half = draft({ key: 'c', party: 'to_referrer', method: '', amount: '50' })
    expect(validateExpenseDrafts([blank])).toEqual({ ready: [], ok: false, error: null })
    const ok = validateExpenseDrafts([good, blank])
    expect(ok.ok).toBe(true)
    expect(ok.ready.map((r) => r.key)).toEqual(['b'])
    const bad = validateExpenseDrafts([good, half])
    expect(bad.ok).toBe(false)
    expect(bad.error).toMatch(/金额/)
  })

  it('★草稿 → 实际支出 payment：入账 amount = 实付（非基数）；无描述列 → note 恒 null', () => {
    const ctx = { caseId: 'ca1', currency: 'AUD', paidAt: '2026-06-24' }
    // 付给公司 100×30% → 实付 30
    expect(draftToExpensePayment(draft({ party: 'to_company', method: 'cash', amount: '100', percent: '30' }), ctx)).toEqual({
      case_id: 'ca1', applicant_id: null, direction: 'to_company', plan_item_id: null,
      amount: 30, currency: 'AUD', method: 'cash', paid_at: '2026-06-24', note: null,
    })
    // 付给介绍人 100 留空 → 实付 100
    expect(draftToExpensePayment(draft({ party: 'to_referrer', method: 'transfer', amount: '100' }), ctx)).toEqual({
      case_id: 'ca1', applicant_id: null, direction: 'to_referrer', plan_item_id: null,
      amount: 100, currency: 'AUD', method: 'transfer', paid_at: '2026-06-24', note: null,
    })
  })

  it('预/实互转 helper：payment ↔ payable 款项（携带付款对象/实付/描述）', () => {
    const pay = { id: 'P1', direction: 'to_company', amount: 30, note: '服务费分成' } as unknown as Payment
    expect(paymentToPayableItem(pay, 'PL')).toEqual({
      plan_id: 'PL', kind: 'payable', expense_direction: 'to_company', fee_category: '服务费分成', amount_due: 30,
    })
    const item = { id: 'IT', amount_due: 30, expense_direction: 'to_company', fee_category: '服务费分成' } as unknown as PaymentPlanItem
    expect(payableItemToPayment(item, { caseId: 'ca1', currency: 'AUD', paidAt: '2026-06-24' })).toEqual({
      case_id: 'ca1', applicant_id: null, direction: 'to_company', plan_item_id: null,
      amount: 30, currency: 'AUD', method: 'transfer', paid_at: '2026-06-24', note: '服务费分成',
    })
  })

  it('账目不变量：实付入账后，现有 selectCaseExpenses 合计 = Σ实付（非基数）', () => {
    const ctx = { caseId: 'ca1', currency: 'AUD', paidAt: '2026-06-24' }
    const drafts = [
      draft({ key: 'a', party: 'to_company', method: 'cash', amount: '100', percent: '30' }), // 实付30
      draft({ key: 'b', party: 'to_referrer', method: 'transfer', amount: '100' }), // 实付100
    ]
    const payments = drafts.map((d, i) => ({ ...draftToExpensePayment(d, ctx), id: `P${i}` }) as unknown as Payment)
    const exp = selectCaseExpenses(payments)
    expect(exp.totals.toCompany).toBe(30) // 入账实付，非基数100
    expect(exp.totals.toReferrer).toBe(100)
    expect(exp.totals.total).toBe(130) // 与 mockup 支出合计一致
  })

  it('emptyExpenseDraft：key 唯一、全空', () => {
    const a = emptyExpenseDraft()
    const b = emptyExpenseDraft()
    expect(a.key).not.toBe(b.key)
    expect(isExpenseDraftBlank(a)).toBe(true)
  })
})
