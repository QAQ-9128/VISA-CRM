import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
  updatePaymentPlan,
} from '../../api/payments'
import type {
  InstallmentInsert,
  InstallmentUpdate,
  PaymentInsert,
  PaymentPlanInsert,
  PaymentPlanUpdate,
} from '../../api/payments'
import { useAuth } from '../useAuth'
import { queryKeys } from './keys'

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
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.payments.plan(caseId) }),
  })
}

export function useUpdatePaymentPlan(caseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: PaymentPlanUpdate }) =>
      updatePaymentPlan(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.payments.plan(caseId) }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.payments.byCase(caseId) }),
  })
}

export function useDeletePayment(caseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deletePayment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.payments.byCase(caseId) }),
  })
}
