import { supabase } from '../lib/supabase'
import type { Case, CaseDocument, Customer, Installment, Payment, PaymentPlan } from '../types/models'

/** 未付分期（逾期的候选，前端再按 due_date 过滤）。 */
export async function getUnpaidInstallments(): Promise<Installment[]> {
  const { data, error } = await supabase.from('installments').select('*').eq('is_paid', false)
  if (error) throw error
  return data ?? []
}

/** 未归档案件（用于查 visa_subclass / customer_id 的查找表）。 */
export async function getActiveCases(): Promise<Case[]> {
  const { data, error } = await supabase.from('cases').select('*').eq('is_archived', false)
  if (error) throw error
  return data ?? []
}

/** 未归档客户（同时用于优先客户与查找姓名）。 */
export async function getActiveCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase.from('customers').select('*').eq('is_archived', false)
  if (error) throw error
  return data ?? []
}

export async function getAllPaymentPlans(): Promise<PaymentPlan[]> {
  const { data, error } = await supabase.from('payment_plans').select('*')
  if (error) throw error
  return data ?? []
}

export async function getAllPayments(): Promise<Payment[]> {
  const { data, error } = await supabase.from('payments').select('*')
  if (error) throw error
  return data ?? []
}

/** 设了到期日、未归档的文件（概览「即将到期」用；前端再按 ≤30 天/已过期过滤）。 */
export async function getExpiringDocuments(): Promise<CaseDocument[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('is_archived', false)
    .not('expiry_date', 'is', null)
  if (error) throw error
  return data ?? []
}
