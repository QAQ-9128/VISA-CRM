import { supabase } from '../lib/supabase'
import type { Installment, Payment, PaymentPlan, PaymentPlanItem } from '../types/models'
import type { TablesInsert, TablesUpdate } from '../types/database'

export type PaymentPlanInsert = TablesInsert<'payment_plans'>
export type PaymentPlanUpdate = TablesUpdate<'payment_plans'>
export type PaymentPlanItemInsert = TablesInsert<'payment_plan_items'>
export type PaymentPlanItemUpdate = TablesUpdate<'payment_plan_items'>
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

// ── payment_plan_items（按费用类别拆分的应收款项明细）──────────
/** 全部款项明细（财务/客户/案件页共用，按 plan_id 在前端过滤）。 */
export async function getAllPlanItems(): Promise<PaymentPlanItem[]> {
  const { data, error } = await supabase
    .from('payment_plan_items')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createPlanItem(input: PaymentPlanItemInsert): Promise<PaymentPlanItem> {
  const { data, error } = await supabase.from('payment_plan_items').insert(input).select().single()
  if (error) throw error
  return data
}

export async function updatePlanItem(
  id: string,
  patch: PaymentPlanItemUpdate,
): Promise<PaymentPlanItem> {
  const { data, error } = await supabase
    .from('payment_plan_items')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/** 真删（RLS 限 admin）。删除守卫「有收款则禁删」在 hook 层用 itemHasPayments 判定。 */
export async function deletePlanItem(id: string): Promise<void> {
  const { error } = await supabase.from('payment_plan_items').delete().eq('id', id)
  if (error) throw error
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

/** 全部分期节点（财务页「分期进度 / 下一期」用，按计划在前端归集）。 */
export async function getAllInstallments(): Promise<Installment[]> {
  const { data, error } = await supabase
    .from('installments')
    .select('*')
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
  // RLS 把 admin-only DELETE 挡掉时是「命中 0 行、不报错」——select 校验行数并显式抛错，
  // 否则 staff 点删除看起来像点了没反应（错误经全局 toast 显示）
  const { data, error } = await supabase.from('installments').delete().eq('id', id).select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('删除被拒绝：需要管理员权限')
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
  // 同 deleteInstallment：撤销收款被 RLS 静默挡掉时必须显式报错（staff 才有反馈）
  const { data, error } = await supabase.from('payments').delete().eq('id', id).select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('撤销被拒绝：需要管理员权限')
}
