import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import {
  createInstallment,
  createPayment,
  createPaymentPlan,
  deleteInstallment,
  deletePayment,
  getPaymentPlanByCase,
  listInstallments,
  listPaymentsByCase,
  updateInstallment,
  updatePayment,
  updatePaymentPlan,
} from '../../api/payments'
import type {
  InstallmentInsert,
  InstallmentUpdate,
  PaymentInsert,
  PaymentPlanInsert,
  PaymentPlanUpdate,
  PaymentUpdate,
} from '../../api/payments'
import { uploadFile } from '../../api/documents'
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
