import type { ListCustomersOptions } from '../../api/customers'

/**
 * TanStack Query 的 query key 工厂。统一在此定义，mutation 成功后按前缀失效。
 * 约定：每个实体的 key 都以实体名开头，失效 ['customers'] 即可批量失效其下所有查询。
 */
export const queryKeys = {
  customers: {
    all: ['customers'] as const,
    list: (opts: ListCustomersOptions = {}) => ['customers', 'list', opts] as const,
    detail: (id: string) => ['customers', 'detail', id] as const,
    subApplicants: (primaryId: string) => ['customers', 'sub', primaryId] as const,
    primaryApplicants: () => ['customers', 'primary'] as const,
  },
  cases: {
    all: ['cases'] as const,
    list: ['cases', 'list'] as const,
    byCustomer: (customerId: string) => ['cases', 'byCustomer', customerId] as const,
    detail: (id: string) => ['cases', 'detail', id] as const,
    stageHistory: (id: string) => ['cases', 'stageHistory', id] as const,
  },
  lodgements: {
    all: ['lodgements'] as const,
    byCase: (caseId: string) => ['lodgements', 'byCase', caseId] as const,
  },
  documents: {
    all: ['documents'] as const,
    byCustomer: (customerId: string) => ['documents', 'byCustomer', customerId] as const,
    byCase: (caseId: string) => ['documents', 'byCase', caseId] as const,
  },
  payments: {
    plan: (caseId: string) => ['payments', 'plan', caseId] as const,
    installments: (planId: string) => ['payments', 'installments', planId] as const,
    byCase: (caseId: string) => ['payments', 'byCase', caseId] as const,
  },
  followUps: {
    all: ['follow_ups'] as const,
    byCustomer: (customerId: string) => ['follow_ups', 'byCustomer', customerId] as const,
    byCase: (caseId: string) => ['follow_ups', 'byCase', caseId] as const,
  },
  tasks: {
    all: ['tasks'] as const,
    byCustomer: (customerId: string) => ['tasks', 'byCustomer', customerId] as const,
    byCase: (caseId: string) => ['tasks', 'byCase', caseId] as const,
    open: ['tasks', 'open'] as const,
  },
  dashboard: {
    pendingLodgements: ['dashboard', 'pendingLodgements'] as const,
    unpaidInstallments: ['dashboard', 'unpaidInstallments'] as const,
    candidateDocuments: ['dashboard', 'candidateDocuments'] as const,
    activeCases: ['dashboard', 'activeCases'] as const,
    activeCustomers: ['dashboard', 'activeCustomers'] as const,
    plans: ['dashboard', 'plans'] as const,
    payments: ['dashboard', 'payments'] as const,
  },
  employers: {
    all: ['employers'] as const,
    list: ['employers', 'list'] as const,
    detail: (id: string) => ['employers', 'detail', id] as const,
  },
}
