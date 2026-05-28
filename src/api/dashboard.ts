import { supabase } from '../lib/supabase'
import type { Case, CaseDocument, Customer, Installment, Lodgement, Payment, PaymentPlan } from '../types/models'

/** 待决递交（临近决签的候选，前端再按剩余天数过滤）。 */
export async function getPendingLodgements(): Promise<Lodgement[]> {
  const { data, error } = await supabase.from('lodgements').select('*').eq('outcome', 'pending')
  if (error) throw error
  return data ?? []
}

/** 未付分期（逾期的候选，前端再按 due_date 过滤）。 */
export async function getUnpaidInstallments(): Promise<Installment[]> {
  const { data, error } = await supabase.from('installments').select('*').eq('is_paid', false)
  if (error) throw error
  return data ?? []
}

/** 未归档且有到期日的文件（快过期候选）。 */
export async function getExpiringCandidateDocuments(): Promise<CaseDocument[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('is_archived', false)
    .not('expiry_date', 'is', null)
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
