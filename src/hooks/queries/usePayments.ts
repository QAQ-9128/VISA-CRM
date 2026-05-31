import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import {
  createInstallment,
  createPayment,
  createPaymentPlan,
  createPlanItem,
  deleteInstallment,
  deletePayment,
  deletePlanItem,
  getAllPlanItems,
  getPaymentPlanByCase,
  listInstallments,
  listPaymentsByCase,
  updateInstallment,
  updatePayment,
  updatePaymentPlan,
  updatePlanItem,
} from '../../api/payments'
import type {
  InstallmentInsert,
  InstallmentUpdate,
  PaymentInsert,
  PaymentPlanInsert,
  PaymentPlanItemInsert,
  PaymentPlanItemUpdate,
  PaymentPlanUpdate,
  PaymentUpdate,
} from '../../api/payments'
import { uploadFile } from '../../api/documents'
import { itemHasPayments } from '../../lib/planItems'
import type { Payment } from '../../types/models'
import { useAuth } from '../useAuth'
import { queryKeys } from './keys'

/**
 * 付款/计划变更后，同时失效「按案件」（客户详情用）与 dashboard 聚合键（概览/财务页用），
 * 保证两处共用同一份底层数据、改一处两处都刷新。
 */
function invalidatePayments(qc: QueryClient, caseId: string) {
  qc.invalidateQueries({ queryKey: queryKeys.payments.byCase(caseId) })
  qc.invalidateQueries({ queryKey: queryKeys.dashboard.payments })
}
function invalidatePlans(qc: QueryClient, caseId: string) {
  qc.invalidateQueries({ queryKey: queryKeys.payments.plan(caseId) })
  qc.invalidateQueries({ queryKey: queryKeys.dashboard.plans })
}
/** 款项明细变更 → 失效全局款项缓存（财务/客户/案件三处共用同一份，改一处全刷新）。 */
function invalidatePlanItems(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: queryKeys.dashboard.planItems })
}

// ── payment plan items（按费用类别拆分的应收款项明细）──────────
export function useAllPlanItems() {
  return useQuery({ queryKey: queryKeys.dashboard.planItems, queryFn: getAllPlanItems })
}

export function useCreatePlanItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: PaymentPlanItemInsert) => createPlanItem(input),
    onSuccess: () => invalidatePlanItems(qc),
  })
}

export function useUpdatePlanItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: PaymentPlanItemUpdate }) => updatePlanItem(id, patch),
    onSuccess: () => invalidatePlanItems(qc),
  })
}

/** 删除款项守卫：名下已有收款 → 抛错「该款项已有收款记录，无法删除」，否则真删。 */
export function useDeletePlanItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payments }: { id: string; payments: Pick<Payment, 'plan_item_id'>[] }) => {
      if (itemHasPayments(id, payments)) throw new Error('该款项已有收款记录，无法删除')
      await deletePlanItem(id)
    },
    onSuccess: () => invalidatePlanItems(qc),
  })
}

// ── payment plan ────────────────────────────────────────────
export function usePaymentPlan(caseId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.payments.plan(caseId ?? ''),
    queryFn: () => getPaymentPlanByCase(caseId as string),
    enabled: !!caseId,
  })
}

export function useCreatePaymentPlan(caseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: PaymentPlanInsert) => createPaymentPlan(input),
    onSuccess: () => invalidatePlans(qc, caseId),
  })
}

export function useUpdatePaymentPlan(caseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: PaymentPlanUpdate }) =>
      updatePaymentPlan(id, patch),
    onSuccess: () => invalidatePlans(qc, caseId),
  })
}

// ── installments ────────────────────────────────────────────
export function useInstallments(planId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.payments.installments(planId ?? ''),
    queryFn: () => listInstallments(planId as string),
    enabled: !!planId,
  })
}

export function useCreateInstallment(planId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: InstallmentInsert) => createInstallment(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.payments.installments(planId) }),
  })
}

export function useUpdateInstallment(planId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: InstallmentUpdate }) =>
      updateInstallment(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.payments.installments(planId) }),
  })
}

export function useDeleteInstallment(planId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteInstallment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.payments.installments(planId) }),
  })
}

// ── payments ────────────────────────────────────────────────
export function usePaymentsByCase(caseId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.payments.byCase(caseId ?? ''),
    queryFn: () => listPaymentsByCase(caseId as string),
    enabled: !!caseId,
  })
}

export function useCreatePayment(caseId: string) {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: (input: PaymentInsert) => createPayment({ ...input, recorded_by: user?.id ?? null }),
    onSuccess: () => invalidatePayments(qc, caseId),
  })
}

export function useUpdatePayment(caseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: PaymentUpdate }) => updatePayment(id, patch),
    onSuccess: () => invalidatePayments(qc, caseId),
  })
}

export function useDeletePayment(caseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deletePayment(id),
    onSuccess: () => invalidatePayments(qc, caseId),
  })
}

/** 给某笔收款上传发票：传到私有 bucket case-files（路径含案件），再写回 payment 的 invoice_path/name。 */
export function useSetPaymentInvoice(caseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      paymentId,
      customerId,
      file,
    }: {
      paymentId: string
      customerId: string
      file: File
    }) => {
      const up = await uploadFile(file, customerId, caseId)
      return updatePayment(paymentId, { invoice_path: up.storage_path, invoice_name: up.file_name })
    },
    onSuccess: () => invalidatePayments(qc, caseId),
  })
}
