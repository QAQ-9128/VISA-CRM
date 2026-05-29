import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as paymentsApi from './payments'
import { wireFrom } from '../test/sbMock'

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { from: fromMock }, setRememberMe: vi.fn() }))

beforeEach(() => {
  fromMock.mockReset()
})

describe('payment_plans', () => {
  it('getPaymentPlanByCase 取案件级（applicant_id 为空）账单', async () => {
    const b = wireFrom(fromMock, { payment_plans: { data: { id: 'p1' } } })
    await paymentsApi.getPaymentPlanByCase('c1')
    expect(fromMock).toHaveBeenCalledWith('payment_plans')
    expect(b.payment_plans.eq).toHaveBeenCalledWith('case_id', 'c1')
    expect(b.payment_plans.is).toHaveBeenCalledWith('applicant_id', null)
    expect(b.payment_plans.maybeSingle).toHaveBeenCalled()
  })

  it('createPaymentPlan 插入', async () => {
    const b = wireFrom(fromMock, { payment_plans: { data: { id: 'p1' } } })
    await paymentsApi.createPaymentPlan({ case_id: 'c1', client_total: 1000 })
    expect(b.payment_plans.insert).toHaveBeenCalledWith({ case_id: 'c1', client_total: 1000 })
  })

  it('updatePaymentPlan 按 id 更新', async () => {
    const b = wireFrom(fromMock, { payment_plans: { data: { id: 'p1' } } })
    await paymentsApi.updatePaymentPlan('p1', { company_total: 800 })
    expect(b.payment_plans.update).toHaveBeenCalledWith({ company_total: 800 })
    expect(b.payment_plans.eq).toHaveBeenCalledWith('id', 'p1')
  })
})

describe('installments', () => {
  it('listInstallments 按 payment_plan_id、按到期日排序', async () => {
    const b = wireFrom(fromMock, { installments: { data: [] } })
    await paymentsApi.listInstallments('p1')
    expect(b.installments.eq).toHaveBeenCalledWith('payment_plan_id', 'p1')
    expect(b.installments.order).toHaveBeenCalledWith('due_date', { ascending: true, nullsFirst: false })
  })

  it('createInstallment 插入', async () => {
    const b = wireFrom(fromMock, { installments: { data: { id: 'i1' } } })
    await paymentsApi.createInstallment({ payment_plan_id: 'p1', amount: 500 })
    expect(b.installments.insert).toHaveBeenCalledWith({ payment_plan_id: 'p1', amount: 500 })
  })

  it('updateInstallment 切换已付', async () => {
    const b = wireFrom(fromMock, { installments: { data: { id: 'i1' } } })
    await paymentsApi.updateInstallment('i1', { is_paid: true, paid_at: '2026-01-01' })
    expect(b.installments.update).toHaveBeenCalledWith({ is_paid: true, paid_at: '2026-01-01' })
    expect(b.installments.eq).toHaveBeenCalledWith('id', 'i1')
  })

  it('deleteInstallment 真删该分期', async () => {
    const b = wireFrom(fromMock, { installments: {} })
    await paymentsApi.deleteInstallment('i1')
    expect(b.installments.delete).toHaveBeenCalled()
    expect(b.installments.eq).toHaveBeenCalledWith('id', 'i1')
  })
})

describe('payments', () => {
  it('listPaymentsByCase 按 case_id', async () => {
    const b = wireFrom(fromMock, { payments: { data: [] } })
    await paymentsApi.listPaymentsByCase('c1')
    expect(fromMock).toHaveBeenCalledWith('payments')
    expect(b.payments.eq).toHaveBeenCalledWith('case_id', 'c1')
  })

  it('createPayment 记一笔（带 direction）', async () => {
    const b = wireFrom(fromMock, { payments: { data: { id: 'pay1' } } })
    await paymentsApi.createPayment({
      case_id: 'c1',
      direction: 'from_client',
      amount: 300,
    })
    expect(b.payments.insert).toHaveBeenCalledWith(
      expect.objectContaining({ case_id: 'c1', direction: 'from_client', amount: 300 }),
    )
  })

  it('createPayment 透传 fee_category（费用类别）', async () => {
    const b = wireFrom(fromMock, { payments: { data: { id: 'pay1' } } })
    await paymentsApi.createPayment({
      case_id: 'c1',
      direction: 'from_client',
      amount: 300,
      fee_category: '律师费',
    })
    expect(b.payments.insert).toHaveBeenCalledWith(
      expect.objectContaining({ fee_category: '律师费' }),
    )
  })

  it('updatePayment 可改 fee_category（含清空为 null）', async () => {
    const b = wireFrom(fromMock, { payments: { data: { id: 'pay1' } } })
    await paymentsApi.updatePayment('pay1', { fee_category: null })
    expect(b.payments.update).toHaveBeenCalledWith({ fee_category: null })
  })

  it('updatePayment 按 id 改金额/方式/备注', async () => {
    const b = wireFrom(fromMock, { payments: { data: { id: 'pay1' } } })
    await paymentsApi.updatePayment('pay1', { amount: 350, method: 'cash', note: '改一下' })
    expect(b.payments.update).toHaveBeenCalledWith({ amount: 350, method: 'cash', note: '改一下' })
    expect(b.payments.eq).toHaveBeenCalledWith('id', 'pay1')
  })

  it('deletePayment 删除一笔', async () => {
    const b = wireFrom(fromMock, { payments: {} })
    await paymentsApi.deletePayment('pay1')
    expect(b.payments.delete).toHaveBeenCalled()
    expect(b.payments.eq).toHaveBeenCalledWith('id', 'pay1')
  })
})
