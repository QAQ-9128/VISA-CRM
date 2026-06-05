/* 只读预览：用预置 mock 数据（零网络）挂载真实 CustomerDetailPage，仅供截图验收，可随时删除。 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import '../index.css'
import { CustomerDetailPage } from '../pages/customers/CustomerDetailPage'
import { AuthContext } from '../providers/auth-context'
import type { AuthContextValue } from '../providers/auth-context'
import { queryKeys } from '../hooks/queries/keys'
import type {
  Case, CaseApplicant, CaseStageHistory, Customer, Employer, Lodgement,
  Payment, PaymentPlan, PaymentPlanItem, RecordRow, Referrer,
} from '../types/models'

const scenario = new URLSearchParams(location.search).get('scenario') === 'single' ? 'single' : 'multi'

const cust = (o: Partial<Customer>): Customer => ({
  id: 'P', full_name: 'Alice', birth_date: null, gender: null, passport_no: null, nationality: null,
  phone: null, email: null, wechat: null, address: null, sponsor_employer_id: null, sponsor_position: null,
  referrer_id: null, primary_applicant_id: null, relationship_to_primary: null, client_source: null,
  is_starred: false, notes: null, assigned_to: null, created_by: null, is_archived: false,
  created_at: '', updated_at: '', ...o,
})
const kase = (o: Partial<Case>): Case => ({
  id: 'C', case_number: '10042X', customer_id: 'P', visa_subclass: '482', visa_stream: 'Core Skill',
  destination_country: null, sponsor_position: null, sponsor_employer_id: null,
  current_stage: 'nomination_lodged', currency: 'AUD', sync_tracking: true,
  trt_reminder_enabled: false, parent_case_id: null, parent_sync_progress: false, assigned_to: null,
  created_by: null, is_archived: false, created_at: '', updated_at: '', ...o,
})
const plan = (o: Partial<PaymentPlan>): PaymentPlan => ({
  id: 'PL', case_id: 'C', applicant_id: null, billed_to_customer_id: null, client_total: null,
  company_total: null, referrer_total: null, staged_billing: false, currency: 'AUD', note: null,
  created_at: '', updated_at: '', ...o,
})
const item = (o: Partial<PaymentPlanItem>): PaymentPlanItem => ({
  id: 'IT', plan_id: 'PL', fee_category: '律师费', amount_due: 100, periods: 1, note: null,
  created_at: '2026-01-01', updated_at: '', ...o,
})
const pay = (o: Partial<Payment>): Payment => ({
  id: 'PAY', case_id: 'C', applicant_id: null, direction: 'from_client', installment_id: null,
  plan_item_id: null, amount: 0, currency: 'AUD', method: 'transfer', paid_at: '2026-05-01', note: null,
  fee_category: null, invoice_path: null, invoice_name: null, from_client_customer_id: null,
  recorded_by: null, created_at: '', ...o,
})
const hist = (o: Partial<CaseStageHistory>): CaseStageHistory => ({
  id: 'H', case_id: 'C', from_stage: null, to_stage: 'nomination_lodged', note: null,
  effective_at: '2026-03-01T00:00:00Z', changed_at: '2026-03-01T00:00:00Z', changed_by: null,
  created_at: '', ...o,
} as CaseStageHistory)
const lodg = (o: Partial<Lodgement>): Lodgement => ({
  id: 'LG', case_id: 'C', type: 'nomination', lodged_date: null, reference_number: null,
  dha_processing_days: 120, created_at: '', updated_at: '', ...o,
} as Lodgement)
const rec = (o: Partial<RecordRow>): RecordRow => ({
  id: 'R', customer_id: 'P', case_id: 'C', type: 'task', content: '催 PTE 成绩', due_date: '2026-07-01',
  is_done: false, done_at: null, assigned_to: null, channel: null, emoji_marker: null,
  created_by: null, created_at: '2026-05-01', updated_at: '', ...o,
})

const alice = cust({ id: 'P', full_name: 'Alice', sponsor_employer_id: 'E1', sponsor_position: 'Finance Broker', referrer_id: 'R1' })
const ben = cust({ id: 'S', full_name: 'Ben', primary_applicant_id: 'P', relationship_to_primary: '配偶' })
const employer: Employer = { id: 'E1', name: 'Company ABC', abn: null, contact_name: null, contact_phone: null, contact_email: null, address: null, note: null, is_archived: false, created_by: null, created_at: '', updated_at: '' } as unknown as Employer
const referrer: Referrer = { id: 'R1', name: 'CICI', phone: null, email: null, note: null, is_archived: false, created_by: null, created_at: '', updated_at: '' } as unknown as Referrer

// 案件：多人场景 482 在前（财务分开→按人分账）；单人场景 Skill Assessment 在前（合并→平铺）
const C482 = kase({ id: 'C482', visa_subclass: '482', visa_stream: 'Core Skill', sync_tracking: false })
const C600 = kase({ id: 'C600', visa_subclass: '600', visa_stream: null, current_stage: 'visa_lodged' })
const CSKILL = kase({ id: 'CSKILL', visa_subclass: 'Skill Assessment', visa_stream: null, current_stage: 'todo', sync_tracking: true })

const cases = scenario === 'single' ? [CSKILL, C482, C600] : [C482, C600, CSKILL]
const sel = cases[0]

// 计划/款项/付款（plans/items/payments 在 if/else 两支都会赋值，故不预置空数组）
let plans: PaymentPlan[]
let items: PaymentPlanItem[]
let payments: Payment[]
let applicantsAll: CaseApplicant[] = []

if (scenario === 'single') {
  plans = [plan({ id: 'plK', case_id: 'CSKILL', applicant_id: null, referrer_total: 50 })]
  items = [item({ id: 'kFee', plan_id: 'plK', fee_category: '评估费', amount_due: 100 })]
  payments = [
    pay({ id: 'k1', case_id: 'CSKILL', plan_item_id: 'kFee', amount: 100 }),
    pay({ id: 'k2', case_id: 'CSKILL', direction: 'to_referrer', amount: 50 }),
  ]
} else {
  applicantsAll = [{ id: 'a1', case_id: 'C482', customer_id: 'S', created_at: '' }]
  plans = [
    plan({ id: 'plP', case_id: 'C482', applicant_id: 'P', referrer_total: 50 }),
    plan({ id: 'plS', case_id: 'C482', applicant_id: 'S', referrer_total: 50 }),
  ]
  items = [
    item({ id: 'lawP', plan_id: 'plP', fee_category: '律师费', amount_due: 100, created_at: '2026-01-01' }),
    item({ id: 'copyP', plan_id: 'plP', fee_category: '文案', amount_due: 100, created_at: '2026-01-02' }),
    item({ id: 'lawS', plan_id: 'plS', fee_category: '律师费', amount_due: 100, created_at: '2026-01-01' }),
    item({ id: 'copyS', plan_id: 'plS', fee_category: '文案', amount_due: 100, created_at: '2026-01-02' }),
  ]
  payments = [
    pay({ id: 'rp1', case_id: 'C482', applicant_id: 'P', plan_item_id: 'lawP', amount: 100 }),
    pay({ id: 'rp2', case_id: 'C482', applicant_id: 'P', plan_item_id: 'copyP', amount: 100 }),
    pay({ id: 'rfp', case_id: 'C482', applicant_id: 'P', direction: 'to_referrer', amount: 50 }),
    pay({ id: 'rs1', case_id: 'C482', applicant_id: 'S', plan_item_id: 'lawS', amount: 100 }),
    pay({ id: 'rs2', case_id: 'C482', applicant_id: 'S', plan_item_id: 'copyS', amount: 50 }),
    pay({ id: 'rfs', case_id: 'C482', applicant_id: 'S', direction: 'to_referrer', amount: 50 }),
  ]
}

const qc = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity, refetchOnMount: false, refetchOnWindowFocus: false } },
})
const seed = (key: readonly unknown[], data: unknown) => qc.setQueryData(key, data)

seed(queryKeys.customers.detail('P'), alice)
seed(queryKeys.customers.list({}), [alice, ben])
seed(queryKeys.dashboard.activeCustomers, [alice, ben])
seed(queryKeys.cases.byCustomer('P'), cases)
seed(queryKeys.familyLinks.all, [])
seed(queryKeys.dashboard.plans, plans)
seed(queryKeys.dashboard.payments, payments)
seed(queryKeys.dashboard.planItems, items)
seed(queryKeys.finance.installments, [])
seed(queryKeys.finance.referrers, [referrer])
seed(queryKeys.caseApplicants.all, applicantsAll)
seed(queryKeys.employers.detail('E1'), employer)
seed(queryKeys.referrers.detail('R1'), referrer)
// 选中案件的本案数据
seed(queryKeys.caseApplicants.byCase(sel.id), applicantsAll.filter((a) => a.case_id === sel.id))
seed(queryKeys.cases.stageHistory(sel.id), [
  hist({ id: 'h1', case_id: sel.id, to_stage: 'nomination_lodged', effective_at: '2026-03-01T00:00:00Z' }),
  hist({ id: 'h2', case_id: sel.id, from_stage: 'nomination_lodged', to_stage: 'visa_lodged', effective_at: '2026-04-10T00:00:00Z' }),
])
seed(queryKeys.lodgements.byCase(sel.id), [
  lodg({ id: 'lg1', case_id: sel.id, type: 'nomination', dha_processing_days: 120 }),
  lodg({ id: 'lg2', case_id: sel.id, type: 'visa', dha_processing_days: 240 }),
])
seed(queryKeys.records.byCase(sel.id), [rec({ id: 'r1', case_id: sel.id })])
seed(queryKeys.documents.byCase(sel.id), [])

const authValue = {
  user: { id: 'u1' }, loading: false, session: null, profile: null, isAdmin: true,
  signIn: async () => {}, signOut: async () => {},
} as unknown as AuthContextValue

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={['/customers/P']}>
          <div className="min-h-svh bg-canvas p-6">
            <Routes>
              <Route path="/customers/:id" element={<CustomerDetailPage />} />
            </Routes>
          </div>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  </StrictMode>,
)
