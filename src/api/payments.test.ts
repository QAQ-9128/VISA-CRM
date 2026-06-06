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

  it('createPaymentPlan / updatePaymentPlan 透传 staged_billing（分阶段收费开关）', async () => {
    const b1 = wireFrom(fromMock, { payment_plans: { data: { id: 'p1' } } })
    await paymentsApi.createPaymentPlan({ case_id: 'c1', staged_billing: true })
    expect(b1.payment_plans.insert).toHaveBeenCalledWith(expect.objectContaining({ staged_billing: true }))

    const b2 = wireFrom(fromMock, { payment_plans: { data: { id: 'p1' } } })
    await paymentsApi.updatePaymentPlan('p1', { staged_billing: false })
    expect(b2.payment_plans.update).toHaveBeenCalledWith({ staged_billing: false })
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

  it('deleteInstallment 真删该分期（select 校验确实删到行）', async () => {
    const b = wireFrom(fromMock, { installments: { data: [{ id: 'i1' }] } })
    await paymentsApi.deleteInstallment('i1')
    expect(b.installments.delete).toHaveBeenCalled()
    expect(b.installments.eq).toHaveBeenCalledWith('id', 'i1')
  })

  // RLS 把 admin-only DELETE 静默挡掉时命中 0 行不报错——必须显式抛错，
  // 否则 staff 点「删除分期」看起来像点了没反应（全局 toast 接住这个错误）
  it('deleteInstallment 命中 0 行（目标不存在/被拒）→ 抛错不静默', async () => {
    wireFrom(fromMock, { installments: { data: [] } })
    await expect(paymentsApi.deleteInstallment('i1')).rejects.toThrow(/不存在|已被/)
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

  it('createPayment / updatePayment 透传 from_client_customer_id（实际付款方）', async () => {
    const b1 = wireFrom(fromMock, { payments: { data: { id: 'pay1' } } })
    await paymentsApi.createPayment({ case_id: 'c1', direction: 'from_client', amount: 5000, from_client_customer_id: 'cuSub' })
    expect(b1.payments.insert).toHaveBeenCalledWith(expect.objectContaining({ from_client_customer_id: 'cuSub' }))

    const b2 = wireFrom(fromMock, { payments: { data: { id: 'pay1' } } })
    await paymentsApi.updatePayment('pay1', { from_client_customer_id: null })
    expect(b2.payments.update).toHaveBeenCalledWith({ from_client_customer_id: null })
  })

  it('deletePayment 删除一笔（select 校验确实删到行）', async () => {
    const b = wireFrom(fromMock, { payments: { data: [{ id: 'pay1' }] } })
    await paymentsApi.deletePayment('pay1')
    expect(b.payments.delete).toHaveBeenCalled()
    expect(b.payments.eq).toHaveBeenCalledWith('id', 'pay1')
  })

  // 同 deleteInstallment：撤销收款被 RLS 静默挡掉时必须显式报错（staff 点撤销才有反馈）
  it('deletePayment 命中 0 行（目标不存在/被拒）→ 抛错不静默', async () => {
    wireFrom(fromMock, { payments: { data: [] } })
    await expect(paymentsApi.deletePayment('pay1')).rejects.toThrow(/不存在|已被/)
  })
})

describe('payment_plan_items', () => {
  it('getAllPlanItems 取全部款项明细', async () => {
    const b = wireFrom(fromMock, { payment_plan_items: { data: [] } })
    await paymentsApi.getAllPlanItems()
    expect(fromMock).toHaveBeenCalledWith('payment_plan_items')
    expect(b.payment_plan_items.select).toHaveBeenCalledWith('*')
  })
  it('createPlanItem 插入款项', async () => {
    const b = wireFrom(fromMock, { payment_plan_items: { data: { id: 'i1' } } })
    await paymentsApi.createPlanItem({ plan_id: 'p1', fee_category: '文案费', amount_due: 2000 })
    expect(b.payment_plan_items.insert).toHaveBeenCalledWith({ plan_id: 'p1', fee_category: '文案费', amount_due: 2000 })
  })
  it('createPlanItem / updatePlanItem 透传 periods（分阶段收费期数）', async () => {
    const b1 = wireFrom(fromMock, { payment_plan_items: { data: { id: 'i1' } } })
    await paymentsApi.createPlanItem({ plan_id: 'p1', fee_category: '意向金', amount_due: 5000, periods: 1 })
    expect(b1.payment_plan_items.insert).toHaveBeenCalledWith(expect.objectContaining({ periods: 1 }))

    const b2 = wireFrom(fromMock, { payment_plan_items: { data: { id: 'i1' } } })
    await paymentsApi.updatePlanItem('i1', { amount_due: 12000, periods: 4 })
    expect(b2.payment_plan_items.update).toHaveBeenCalledWith({ amount_due: 12000, periods: 4 })
  })
  it('updatePlanItem 按 id 改应收', async () => {
    const b = wireFrom(fromMock, { payment_plan_items: { data: { id: 'i1' } } })
    await paymentsApi.updatePlanItem('i1', { amount_due: 1500 })
    expect(b.payment_plan_items.update).toHaveBeenCalledWith({ amount_due: 1500 })
    expect(b.payment_plan_items.eq).toHaveBeenCalledWith('id', 'i1')
  })
  it('deletePlanItem 真删该款项', async () => {
    const b = wireFrom(fromMock, { payment_plan_items: {} })
    await paymentsApi.deletePlanItem('i1')
    expect(b.payment_plan_items.delete).toHaveBeenCalled()
    expect(b.payment_plan_items.eq).toHaveBeenCalledWith('id', 'i1')
  })
})
