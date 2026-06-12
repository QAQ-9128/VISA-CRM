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
    stageHistoryAll: ['cases', 'stageHistoryAll'] as const,
  },
  caseApplicants: {
    all: ['case_applicants'] as const,
    byCase: (caseId: string) => ['case_applicants', 'byCase', caseId] as const,
  },
  lodgements: {
    all: ['lodgements'] as const,
    byCase: (caseId: string) => ['lodgements', 'byCase', caseId] as const,
    lodged: ['lodgements', 'lodged'] as const,
  },
  documents: {
    all: ['documents'] as const,
    allList: ['documents', 'allList'] as const,
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
  profiles: {
    all: ['profiles'] as const,
    list: ['profiles', 'list'] as const,
  },
  records: {
    all: ['records'] as const,
    byCustomer: (customerId: string) => ['records', 'byCustomer', customerId] as const,
    byCase: (caseId: string) => ['records', 'byCase', caseId] as const,
    open: ['records', 'open'] as const,
  },
  tasks: {
    all: ['tasks'] as const,
    byCustomer: (customerId: string) => ['tasks', 'byCustomer', customerId] as const,
    byCase: (caseId: string) => ['tasks', 'byCase', caseId] as const,
    open: ['tasks', 'open'] as const,
  },
  dashboard: {
    unpaidInstallments: ['dashboard', 'unpaidInstallments'] as const,
    activeCases: ['dashboard', 'activeCases'] as const,
    activeCustomers: ['dashboard', 'activeCustomers'] as const,
    plans: ['dashboard', 'plans'] as const,
    payments: ['dashboard', 'payments'] as const,
    planItems: ['dashboard', 'planItems'] as const,
    expiringDocs: ['dashboard', 'expiringDocs'] as const,
  },
  employers: {
    all: ['employers'] as const,
    list: ['employers', 'list'] as const,
    detail: (id: string) => ['employers', 'detail', id] as const,
  },
  referrers: {
    all: ['referrers'] as const,
    list: ['referrers', 'list'] as const,
    detail: (id: string) => ['referrers', 'detail', id] as const,
  },
  immiAccounts: {
    all: ['immi_accounts'] as const,
    list: ['immi_accounts', 'list'] as const,
    detail: (id: string) => ['immi_accounts', 'detail', id] as const,
  },
  finance: {
    referrers: ['finance', 'referrers'] as const,
    installments: ['finance', 'installments'] as const,
  },
  checklist: {
    all: ['checklist'] as const,
  },
  familyLinks: {
    all: ['family_member_links'] as const,
  },
}
