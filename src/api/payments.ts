import { supabase } from '../lib/supabase'
import type { Installment, Payment, PaymentPlan } from '../types/models'
import type { TablesInsert, TablesUpdate } from '../types/database'

export type PaymentPlanInsert = TablesInsert<'payment_plans'>
export type PaymentPlanUpdate = TablesUpdate<'payment_plans'>
export type InstallmentInsert = TablesInsert<'installments'>
export type InstallmentUpdate = TablesUpdate<'installments'>
export type PaymentInsert = TablesInsert<'payments'>
export type PaymentUpdate = TablesUpdate<'payments'>

// ── payment_plans ────────────────────────────────────────────
/** 案件级（合并）账单：applicant_id 为空那一份。按申请人拆分的账单走全局查询 + 选择器。 */
export async function getPaymentPlanByCase(caseId: string): Promise<PaymentPlan | null> {
  const { data, error } = await supabase
    .from('payment_plans')
    .select('*')
    .eq('case_id', caseId)
    .is('applicant_id', null)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createPaymentPlan(input: PaymentPlanInsert): Promise<PaymentPlan> {
  const { data, error } = await supabase.from('payment_plans').insert(input).select().single()
  if (error) throw error
  return data
}

export async function updatePaymentPlan(
  id: string,
  patch: PaymentPlanUpdate,
): Promise<PaymentPlan> {
  const { data, error } = await supabase
    .from('payment_plans')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── installments（分期节点）─────────────────────────────────
export async function listInstallments(planId: string): Promise<Installment[]> {
  const { data, error } = await supabase
    .from('installments')
    .select('*')
    .eq('payment_plan_id', planId)
    .order('due_date', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data ?? []
}

export async function createInstallment(input: InstallmentInsert): Promise<Installment> {
  const { data, error } = await supabase.from('installments').insert(input).select().single()
  if (error) throw error
  return data
}

export async function updateInstallment(
  id: string,
  patch: InstallmentUpdate,
): Promise<Installment> {
  const { data, error } = await supabase
    .from('installments')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/** 分期是计划的子项，直接删除（非业务软删）。RLS 限 admin。 */
export async function deleteInstallment(id: string): Promise<void> {
  const { error } = await supabase.from('installments').delete().eq('id', id)
  if (error) throw error
}

// ── payments（实收实付，带方向）──────────────────────────────
export async function listPaymentsByCase(caseId: string): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('case_id', caseId)
    .order('paid_at', { ascending: false, nullsFirst: false })
  if (error) throw error
  return data ?? []
}

export async function createPayment(input: PaymentInsert): Promise<Payment> {
  const { data, error } = await supabase.from('payments').insert(input).select().single()
  if (error) throw error
  return data
}

export async function updatePayment(id: string, patch: PaymentUpdate): Promise<Payment> {
  const { data, error } = await supabase
    .from('payments')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deletePayment(id: string): Promise<void> {
  const { error } = await supabase.from('payments').delete().eq('id', id)
  if (error) throw error
}
