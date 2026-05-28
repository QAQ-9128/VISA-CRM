import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as dashboardApi from './dashboard'
import { wireFrom } from '../test/sbMock'

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { from: fromMock }, setRememberMe: vi.fn() }))

beforeEach(() => {
  fromMock.mockReset()
})

describe('getPendingLodgements', () => {
  it('只取 outcome=pending', async () => {
    const b = wireFrom(fromMock, { lodgements: { data: [] } })
    await dashboardApi.getPendingLodgements()
    expect(fromMock).toHaveBeenCalledWith('lodgements')
    expect(b.lodgements.eq).toHaveBeenCalledWith('outcome', 'pending')
  })
})

describe('getUnpaidInstallments', () => {
  it('只取 is_paid=false', async () => {
    const b = wireFrom(fromMock, { installments: { data: [] } })
    await dashboardApi.getUnpaidInstallments()
    expect(b.installments.eq).toHaveBeenCalledWith('is_paid', false)
  })
})

describe('getExpiringCandidateDocuments', () => {
  it('未归档且 expiry_date 非空', async () => {
    const b = wireFrom(fromMock, { documents: { data: [] } })
    await dashboardApi.getExpiringCandidateDocuments()
    expect(b.documents.eq).toHaveBeenCalledWith('is_archived', false)
    expect(b.documents.not).toHaveBeenCalledWith('expiry_date', 'is', null)
  })
})

describe('getActiveCustomers / getActiveCases', () => {
  it('排除归档', async () => {
    const b1 = wireFrom(fromMock, { customers: { data: [] } })
    await dashboardApi.getActiveCustomers()
    expect(b1.customers.eq).toHaveBeenCalledWith('is_archived', false)

    const b2 = wireFrom(fromMock, { cases: { data: [] } })
    await dashboardApi.getActiveCases()
    expect(b2.cases.eq).toHaveBeenCalledWith('is_archived', false)
  })
})

describe('getAllPaymentPlans / getAllPayments', () => {
  it('全量取付款计划与收付款', async () => {
    const b1 = wireFrom(fromMock, { payment_plans: { data: [] } })
    await dashboardApi.getAllPaymentPlans()
    expect(fromMock).toHaveBeenCalledWith('payment_plans')
    expect(b1.payment_plans.select).toHaveBeenCalledWith('*')

    const b2 = wireFrom(fromMock, { payments: { data: [] } })
    await dashboardApi.getAllPayments()
    expect(b2.payments.select).toHaveBeenCalledWith('*')
  })
})
