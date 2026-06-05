/* 只读预览：用预置 mock 数据（零网络）挂载真实页面，仅供截图验收，可随时删除。
 *
 * 用法（dev server 下打开 /preview-customer.html）：
 *   ?page=customer|dashboard|finance|cases|archive   选页面（默认 customer）
 *   &scenario=single                                  客户页单人案件场景
 *   &admin=0                                          以 staff 视角渲染（彻底删除/回收站应消失）
 *
 * 种子数据特意埋了归档泄漏探针：
 *   - Zoe（已归档客户）名下文件、CARCH（已归档案件）的文件/发票/付款
 *   → 概览「临近到期」、档案库、本月收款、月度账目都【不应】出现它们。
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import '../index.css'
import { AppLayout } from '../layouts/AppLayout'
import { CustomerDetailPage } from '../pages/customers/CustomerDetailPage'
import { DashboardPage } from '../pages/DashboardPage'
import { FinancePage } from '../pages/finance/FinancePage'
import { CasesPage } from '../pages/cases/CasesPage'
import { ArchivePage } from '../pages/archive/ArchivePage'
import { RecycleBin } from '../pages/archive/RecycleBin'
import { ReferrerListPage } from '../pages/referrers/ReferrerListPage'
import { CustomerFormPage } from '../pages/customers/CustomerFormPage'
import { AuthContext } from '../providers/auth-context'
import type { AuthContextValue } from '../providers/auth-context'
import { queryKeys } from '../hooks/queries/keys'
import type {
  Case, CaseApplicant, CaseDocument, CaseStageHistory, ChecklistItem, Customer, Employer,
  Installment, Lodgement, Payment, PaymentPlan, PaymentPlanItem, Profile, RecordRow, Referrer,
} from '../types/models'

const params = new URLSearchParams(location.search)
const page = params.get('page') ?? 'customer'
const scenario = params.get('scenario') === 'single' ? 'single' : 'multi'
const isAdmin = params.get('admin') !== '0'

// 冻结网络：seed 即真相。refetchOnMount:'always' 的查询（档案库/回收站）会发起请求，
// 永不 resolve 的 fetch 让它们停在 fetching 态、继续展示种子数据，不会被线上空数据覆盖。
window.fetch = () => new Promise<Response>(() => {})

const cust = (o: Partial<Customer>): Customer => ({
  id: 'P', full_name: 'Alice', birth_date: null, gender: null, passport_no: null, nationality: null,
  phone: null, email: null, wechat: null, address: null, sponsor_employer_id: null, sponsor_position: null,
  referrer_id: null, owner_referrer_id: null, primary_applicant_id: null, relationship_to_primary: null, client_source: null,
  is_starred: false, notes: null, assigned_to: null, created_by: null, is_archived: false,
  created_at: '', updated_at: '', ...o,
})
const kase = (o: Partial<Case>): Case => ({
  id: 'C', case_number: '10042X', customer_id: 'P', visa_subclass: '482', visa_stream: 'Core Skill',
  destination_country: null, sponsor_position: null, sponsor_employer_id: null,
  current_stage: 'nomination_lodged', currency: 'AUD', sync_tracking: true,
  trt_reminder_enabled: false, parent_case_id: null, parent_sync_progress: false, assigned_to: null,
  created_by: null, is_archived: false, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-06-01T00:00:00Z', ...o,
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
  id: 'PAY', case_id: 'C482', applicant_id: null, direction: 'from_client', installment_id: null,
  plan_item_id: null, amount: 0, currency: 'AUD', method: 'transfer', paid_at: '2026-05-01', note: null,
  fee_category: null, invoice_path: null, invoice_name: null, from_client_customer_id: null,
  recorded_by: 'u1', created_at: '2026-05-01T00:00:00Z', ...o,
})
const hist = (o: Partial<CaseStageHistory>): CaseStageHistory => ({
  id: 'H', case_id: 'C482', from_stage: null, to_stage: 'nomination_lodged', note: null,
  effective_at: '2026-03-01T00:00:00Z', changed_at: '2026-03-01T00:00:00Z', changed_by: null,
  created_at: '',
  ...o,
} as CaseStageHistory)
const lodg = (o: Partial<Lodgement>): Lodgement => ({
  id: 'LG', case_id: 'C482', type: 'nomination', lodged_date: null, reference_number: null,
  dha_processing_days: 120, created_at: '', updated_at: '', ...o,
} as Lodgement)
const rec = (o: Partial<RecordRow>): RecordRow => ({
  id: 'R', customer_id: 'P', case_id: 'C482', type: 'task', content: '催 PTE 成绩', due_date: '2026-07-01',
  is_done: false, done_at: null, assigned_to: null, channel: null, emoji_marker: null,
  created_by: null, created_at: '2026-05-01', updated_at: '', ...o,
})
const doc = (o: Partial<CaseDocument>): CaseDocument => ({
  id: 'D', customer_id: 'P', case_id: null, doc_type: 'passport', title: null, storage_path: null,
  file_name: null, issue_date: null, expiry_date: null, note: null, uploaded_by: 'u1',
  is_archived: false, created_at: '2026-05-10T00:00:00Z', updated_at: '', ...o,
})
const inst = (o: Partial<Installment>): Installment => ({
  id: 'I', payment_plan_id: 'plP', label: null, due_date: null, amount: 100, is_paid: false,
  paid_at: null, created_at: '', updated_at: '', ...o,
})
const chk = (o: Partial<ChecklistItem>): ChecklistItem => ({
  id: 'K', content: '随手记', is_done: false, customer_id: null, case_id: null,
  created_at: '2026-06-01T00:00:00Z', updated_at: '', ...o,
} as ChecklistItem)

// ── 人物 / 案件 ───────────────────────────────────────────────
const alice = cust({ id: 'P', full_name: 'Alice', sponsor_employer_id: 'E1', sponsor_position: 'Finance Broker', referrer_id: 'R1', owner_referrer_id: 'O1', is_starred: true, gender: 'male' })
const ben = cust({ id: 'S', full_name: 'Ben', primary_applicant_id: 'P', relationship_to_primary: '配偶' })
const zoe = cust({ id: 'Z', full_name: 'Zoe（已归档）', is_archived: true }) // 归档客户：任何页面不应露出她的东西
const employer: Employer = { id: 'E1', name: 'Company ABC', abn: null, contact_name: null, contact_phone: null, contact_email: null, address: null, note: null, is_archived: false, created_by: null, created_at: '', updated_at: '' } as unknown as Employer
const employerArch: Employer = { ...employer, id: 'EA', name: '旧雇主（已归档）', is_archived: true } as Employer
const referrer: Referrer = { id: 'R1', name: 'CICI', kind: 'referrer', phone: null, email: null, note: null, is_archived: false, created_by: null, created_at: '', updated_at: '' } as unknown as Referrer
const referrerArch: Referrer = { ...referrer, id: 'RA', name: '旧介绍人（已归档）', is_archived: true } as Referrer
// 归属人（与介绍人同表 kind=owner）：Alice 归属于 刘祎
const owner: Referrer = { ...referrer, id: 'O1', name: '刘祎', kind: 'owner' } as Referrer
const profileU1 = { id: 'u1', role: 'admin', full_name: '李顾问', active: true, created_at: '', updated_at: '' } as unknown as Profile

const C482 = kase({ id: 'C482', case_number: '10042X', visa_subclass: '482', visa_stream: 'Core Skill', sync_tracking: false, updated_at: '2026-06-03T00:00:00Z' })
const C600 = kase({ id: 'C600', case_number: '10043Y', visa_subclass: '600', visa_stream: null, current_stage: 'visa_lodged', updated_at: '2026-05-20T00:00:00Z' })
const CSKILL = kase({ id: 'CSKILL', case_number: '10044Z', visa_subclass: 'Skill Assessment', visa_stream: null, current_stage: 'todo', sync_tracking: true })
const CARCH = kase({ id: 'CARCH', case_number: '99999A', customer_id: 'Z', visa_subclass: '186', is_archived: true }) // 归档案件

const activeCases = scenario === 'single' ? [CSKILL, C482, C600] : [C482, C600, CSKILL]
const sel = activeCases[0]

// ── 财务（多人 482 分人记账 + 归档案件的钱作为不应出现的探针）────────
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
    plan({ id: 'plARCH', case_id: 'CARCH', client_total: 9999 }), // 归档案件的计划：欠款不应计入
  ]
  items = [
    item({ id: 'lawP', plan_id: 'plP', fee_category: '律师费', amount_due: 1000, created_at: '2026-01-01' }),
    item({ id: 'copyP', plan_id: 'plP', fee_category: '文案', amount_due: 500, created_at: '2026-01-02' }),
    item({ id: 'lawS', plan_id: 'plS', fee_category: '律师费', amount_due: 1000, created_at: '2026-01-01' }),
    item({ id: 'copyS', plan_id: 'plS', fee_category: '文案', amount_due: 500, created_at: '2026-01-02' }),
  ]
  payments = [
    // 本月（2026-06）真实进账：1000 + 500 = 1500；支出 300 + 200 = 500
    pay({ id: 'rp1', applicant_id: 'P', plan_item_id: 'lawP', amount: 1000, paid_at: '2026-06-02', fee_category: '律师费' }),
    pay({ id: 'rs1', applicant_id: 'S', plan_item_id: 'lawS', amount: 500, paid_at: '2026-06-03', note: '首期' }),
    pay({ id: 'pc', direction: 'to_company', amount: 300, paid_at: '2026-06-04', note: '提名代理费' }),
    pay({ id: 'pr', direction: 'to_referrer', amount: 200, paid_at: '2026-06-05' }),
    // 上月一笔（环比/上月用）
    pay({ id: 'prev', applicant_id: 'P', plan_item_id: 'copyP', amount: 200, paid_at: '2026-05-15' }),
    // 发票：C482 一张（档案库应显示；0 元但带发票 → 账目明细应保留）
    pay({ id: 'inv1', applicant_id: 'P', amount: 0, paid_at: '2026-06-01', invoice_path: 'P/C482/inv-1.pdf', invoice_name: 'invoice-482.pdf' }),
    // ⚠ 探针：裸 0 元付款（无发票）→ 账目明细不应出现
    pay({ id: 'zeroBare', applicant_id: 'P', amount: 0, paid_at: '2026-06-04' }),
    // ⚠ 探针：归档案件 CARCH 的钱与发票——概览/账目/档案库都不应出现
    pay({ id: 'ARCH$', case_id: 'CARCH', amount: 8888, paid_at: '2026-06-02' }),
    pay({ id: 'ARCHinv', case_id: 'CARCH', amount: 0, paid_at: '2026-06-02', invoice_path: 'Z/CARCH/inv-x.pdf', invoice_name: '泄漏发票.pdf' }),
  ]
}

// ── 文件（档案库 + 概览到期探针）────────────────────────────────
const docs = {
  // 在册客户的正常文件：档案库应显示；6/20 到期 → 概览「临近到期」应显示
  fileOk: doc({ id: 'dOK', customer_id: 'P', file_name: 'Alice-护照.pdf', storage_path: 'P/general/passport.pdf', expiry_date: '2026-06-20' }),
  // ⚠ 探针：归档客户 Zoe 的文件 → 档案库不应显示
  fileZoe: doc({ id: 'dZ', customer_id: 'Z', file_name: 'Zoe-泄漏文件.pdf', storage_path: 'Z/general/leak.pdf' }),
  // ⚠ 探针：挂在归档案件 CARCH 上的到期文件 → 概览「临近到期」与档案库都不应显示
  fileArch: doc({ id: 'dA', customer_id: 'P', case_id: 'CARCH', file_name: '归档案件体检.pdf', storage_path: 'P/CARCH/med.pdf', doc_type: 'medical', expiry_date: '2026-06-15' }),
  // 回收站里的已归档文件
  fileBin: doc({ id: 'dBin', customer_id: 'P', file_name: '已删文件.pdf', storage_path: 'P/general/old.pdf', is_archived: true }),
}

const qc = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity, refetchOnMount: false, refetchOnWindowFocus: false } },
})
const seed = (key: readonly unknown[], data: unknown) => qc.setQueryData(key, data)

// 客户/案件
seed(queryKeys.customers.detail('P'), alice)
seed(queryKeys.customers.list({}), [alice, ben])
seed(queryKeys.customers.list({ includeArchived: true }), [alice, ben, zoe])
seed(queryKeys.dashboard.activeCustomers, [alice, ben])
seed(queryKeys.cases.byCustomer('P'), activeCases)
seed(queryKeys.cases.list, activeCases)
seed([...queryKeys.cases.list, { includeArchived: true }], [...activeCases, CARCH])
seed(queryKeys.dashboard.activeCases, activeCases)
seed(queryKeys.familyLinks.all, [])
seed(queryKeys.caseApplicants.all, applicantsAll)
seed(queryKeys.employers.list, [employer])
seed([...queryKeys.employers.list, { includeArchived: true }], [employer, employerArch])
seed(queryKeys.referrers.list, [referrer, owner])
seed([...queryKeys.referrers.list, { includeArchived: true }], [referrer, owner, referrerArch])
seed(queryKeys.referrers.detail('O1'), owner)
seed(queryKeys.employers.detail('E1'), employer)
seed(queryKeys.referrers.detail('R1'), referrer)
seed(queryKeys.profiles.list, [profileU1])
// 财务
seed(queryKeys.dashboard.plans, plans)
seed(queryKeys.dashboard.payments, payments)
seed(queryKeys.dashboard.planItems, items)
seed(queryKeys.finance.installments, [
  inst({ id: 'iOver', payment_plan_id: 'plP', amount: 300, due_date: '2026-05-20' }), // 逾期未付
])
seed(queryKeys.dashboard.unpaidInstallments, [
  inst({ id: 'iOver', payment_plan_id: 'plP', amount: 300, due_date: '2026-05-20' }),
])
seed(queryKeys.finance.referrers, [referrer, referrerArch])
// 阶段历史 / 递交（C482 提名递交中、C600 签证递交中）
const allHist = [
  hist({ id: 'h1', case_id: 'C482', to_stage: 'nomination_lodged', effective_at: '2026-03-01T00:00:00Z' }),
  hist({ id: 'h2', case_id: 'C600', to_stage: 'visa_lodged', effective_at: '2026-04-10T00:00:00Z' }),
]
seed(queryKeys.cases.stageHistoryAll, allHist)
seed(queryKeys.lodgements.lodged, [
  lodg({ id: 'lg1', case_id: 'C482', type: 'nomination', dha_processing_days: 120 }),
  lodg({ id: 'lg2', case_id: 'C600', type: 'visa', dha_processing_days: 240 }),
])
seed(queryKeys.records.open, [rec({ id: 'r1' })])
// 文件
seed(queryKeys.dashboard.expiringDocs, [docs.fileOk, docs.fileArch])
seed(queryKeys.documents.allList, [docs.fileOk, docs.fileZoe, docs.fileArch])
seed([...queryKeys.documents.all, 'archived'], [docs.fileBin])
// 待办清单（概览）：1 条随手记 + 1 条关联案件（chip 应链到 /customers/P?case=C482）
seed(queryKeys.checklist.all, [
  chk({ id: 'k1', content: '2026/6/1 Guoywfan 提名' }),
  chk({ id: 'k2', content: '蒋青霞 482 合同未签', case_id: 'C482' }),
])
// 客户页选中案件的本案数据
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
  user: { id: 'u1' }, loading: false, session: null,
  profile: { id: 'u1', role: isAdmin ? 'admin' : 'staff', full_name: '李顾问', active: true },
  isAdmin,
  signIn: async () => {}, signOut: async () => {},
} as unknown as AuthContextValue

const ENTRY: Record<string, string> = {
  customer: '/customers/P',
  dashboard: '/',
  finance: '/finance',
  cases: '/cases',
  archive: '/storage',
  recycle: '/storage', // 静态截图点不了 tab → 直接渲染 RecycleBin
  referrers: '/referrers',
  owners: '/referrers?kind=owner', // 介绍人页·归属人视图
  quick: '/customers/new', // 新建客户页（快速建档卡 + 完整表单并存）
  edit: '/customers/P/edit', // 编辑客户（完整表单，回填 Alice）
}

// 截图辅助：?focus=owner → 渲染后聚焦第一个归属人下拉，展开选项列表（无头截图点不了输入框）
if (params.get('focus') === 'owner') {
  window.setTimeout(() => {
    document.querySelector<HTMLInputElement>('[role="combobox"]')?.focus()
  }, 600)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={[ENTRY[page] ?? ENTRY.customer]}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/customers/new" element={<CustomerFormPage />} />
              <Route path="/customers/:id/edit" element={<CustomerFormPage />} />
              <Route path="/customers/:id" element={<CustomerDetailPage />} />
              <Route path="/finance" element={<FinancePage />} />
              <Route path="/cases" element={<CasesPage />} />
              <Route path="/storage" element={page === 'recycle' ? <RecycleBin /> : <ArchivePage />} />
              <Route path="/referrers" element={<ReferrerListPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  </StrictMode>,
)
