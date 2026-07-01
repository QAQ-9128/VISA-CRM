/* 只读预览：用预置 mock 数据（零网络）挂载真实页面，仅供截图验收，可随时删除。
 *
 * 用法（dev server 下打开 /preview-customer.html）：
 *   ?page=customer|dashboard|finance|cases|archive   选页面（默认 customer）
 *   &scenario=single                                  客户页单人案件场景
 *   &admin=0                                          以 staff 视角渲染（侧栏「账号」应消失；彻底删除 0031 起全员开放，仍显示）
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
import { ReferrerFormPage } from '../pages/referrers/ReferrerFormPage'
import { CustomerFormPage } from '../pages/customers/CustomerFormPage'
import { GroupManagementPage } from '../pages/customers/GroupManagementPage'
import { CaseFormPage } from '../pages/cases/CaseFormPage'
import { CustomerListPage } from '../pages/customers/CustomerListPage'
import { FancySelect, ComboBox } from '../components/ui/FancySelect'
import type { FancyOption } from '../components/ui/FancySelect'
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
  chinese_name: null, english_name: null,
  phone: null, email: null, wechat: null, address: null, sponsor_employer_id: null, sponsor_position: null,
  referrer_id: null, owner_referrer_id: null, primary_applicant_id: null, relationship_to_primary: null, client_source: null,
  is_starred: false, notes: null, assigned_to: null, created_by: null, is_archived: false,
  created_at: '', updated_at: '', ...o,
})
const kase = (o: Partial<Case>): Case => ({
  id: 'C', case_number: '10042X', customer_id: 'P', visa_subclass: '482', visa_stream: 'Core Skill', case_category: null, case_details: null,
  destination_country: null, sponsor_position: null, sponsor_employer_id: null, immi_account_id: null,
  current_stage: 'nomination_lodged', currency: 'AUD', sync_tracking: true,
  trt_reminder_enabled: false, trt_reminder_dismissed: false, cohab_reminder_enabled: false, cohab_reminder_last: null, parent_case_id: null, parent_sync_progress: false, assigned_to: null,
  created_by: null, is_archived: false, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-06-01T00:00:00Z', ...o,
})
const plan = (o: Partial<PaymentPlan>): PaymentPlan => ({
  id: 'PL', case_id: 'C', applicant_id: null, billed_to_customer_id: null, client_total: null,
  company_total: null, referrer_total: null, staged_billing: false, currency: 'AUD', note: null,
  created_at: '', updated_at: '', ...o,
})
const item = (o: Partial<PaymentPlanItem>): PaymentPlanItem => ({
  id: 'IT', plan_id: 'PL', fee_category: '律师费', amount_due: 100, periods: 1, note: null,
  kind: null, expense_direction: null, is_shared: false, created_at: '2026-01-01', updated_at: '', ...o,
})
const pay = (o: Partial<Payment>): Payment => ({
  id: 'PAY', case_id: 'C482', applicant_id: null, direction: 'from_client', installment_id: null,
  plan_item_id: null, amount: 0, currency: 'AUD', method: 'transfer', paid_at: '2026-05-01', note: null,
  fee_category: null, invoice_path: null, invoice_name: null, from_client_customer_id: null,
  is_shared: false, recorded_by: 'u1', created_at: '2026-05-01T00:00:00Z', ...o,
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
const referrer: Referrer = { id: 'R1', name: 'CICI', kind: 'referrer', contact_phone: null, contact_email: null, notes: '123124124 老客户介绍，长备注会在列表里截断、悬浮看全', is_archived: false, created_by: null, created_at: '', updated_at: '' } as unknown as Referrer
const referrerArch: Referrer = { ...referrer, id: 'RA', name: '旧介绍人（已归档）', is_archived: true } as Referrer
// 归属人（与介绍人同表 kind=owner）：Alice 归属于 刘祎
const owner: Referrer = { ...referrer, id: 'O1', name: '刘祎', kind: 'owner' } as Referrer
const profileU1 = { id: 'u1', role: 'admin', full_name: '李顾问', active: true, created_at: '', updated_at: '' } as unknown as Profile

const C482 = kase({ id: 'C482', case_number: '10042X', visa_subclass: '482', visa_stream: 'Core Skill', sync_tracking: false, updated_at: '2026-06-03T00:00:00Z' })
const C600 = kase({ id: 'C600', case_number: '10043Y', visa_subclass: '600', visa_stream: null, current_stage: 'visa_lodged', updated_at: '2026-05-20T00:00:00Z' })
const CSKILL = kase({ id: 'CSKILL', case_number: '10044Z', visa_subclass: 'Skill Assessment', visa_stream: null, current_stage: 'todo', sync_tracking: true })
// 需要行动案件（阶段类别=action，概览主角左栏顶部应高亮）
const CACT = kase({ id: 'CACT', case_number: '10045A', customer_id: 'S', visa_subclass: '482', visa_stream: '补件材料', current_stage: 'docs_requested' })
const CARCH = kase({ id: 'CARCH', case_number: '99999A', customer_id: 'Z', visa_subclass: '186', is_archived: true }) // 归档案件
// 职业评估案件（截图用）：case_category='职业评估'、当前阶段=oa_skill_submitted（专属 7 阶段集合）
const COA = kase({ id: 'COA', case_number: '70021S', visa_subclass: 'Skill Assessment', visa_stream: null, case_category: '职业评估', current_stage: 'oa_skill_submitted', sync_tracking: true, case_details: { 评估机构: 'VETASSESS', 评估职位: 'Cook' } })
// 新建（未推进）职业评估案件：current_stage=todo（DB 默认），无阶段史 → 当前阶段显示「无」
const COANEW = kase({ id: 'COANEW', case_number: '70099S', visa_subclass: 'Skill Assessment', visa_stream: null, case_category: '职业评估', current_stage: 'todo', sync_tracking: true, case_details: { 评估机构: 'VETASSESS', 评估职位: 'Developer Programmer' } })

// De Facto 案件（截图用）：case_category='De Facto 关系认定'、visa_subclass='De Facto'、用途(case_details)、
// current_stage=df_submitted（专属 6 阶段集合，阶段史 df_prep→df_submitted）。
const CDF = kase({ id: 'CDF', case_number: '80031D', visa_subclass: 'De Facto', visa_stream: null, case_category: 'De Facto 关系认定', current_stage: 'df_submitted', sync_tracking: false, case_details: { 用途: '独立关系认定' } })
// 新建（未推进）De Facto 案件：current_stage=df_prep（新建默认落第一阶段），但**无阶段流转记录** →「更新至」行应隐藏
const CDFNEW = kase({ id: 'CDFNEW', case_number: '80099D', visa_subclass: 'De Facto', visa_stream: null, case_category: 'De Facto 关系认定', current_stage: 'df_prep', sync_tracking: false, case_details: { 用途: '配合签证申请' } })

const activeCases = scenario === 'single' ? [CSKILL, C482, C600, CACT, COA, COANEW, CDF, CDFNEW] : [C482, C600, CSKILL, CACT, COA, COANEW, CDF, CDFNEW]
const sel = activeCases[0]

// ── 财务（多人 482 分人记账 + 归档案件的钱作为不应出现的探针）────────
let plans: PaymentPlan[]
let items: PaymentPlanItem[]
let payments: Payment[]
let applicantsAll: CaseApplicant[] = []

if (scenario === 'single') {
  plans = [plan({ id: 'plK', case_id: 'CSKILL', applicant_id: null, referrer_total: 50 })]
  items = [
    item({ id: 'kFee', plan_id: 'plK', fee_category: '评估费', amount_due: 100 }),
    // 预支出（payable）：付给公司 服务费分成 200，记支出后转实际
    item({ id: 'kPre', plan_id: 'plK', fee_category: '服务费分成', amount_due: 200, kind: 'payable', expense_direction: 'to_company', created_at: '2026-06-06' }),
  ]
  payments = [
    pay({ id: 'k1', case_id: 'CSKILL', plan_item_id: 'kFee', amount: 100 }),
    pay({ id: 'k2', case_id: 'CSKILL', direction: 'to_referrer', amount: 50, note: '介绍费' }),
    pay({ id: 'k3', case_id: 'CSKILL', direction: 'to_company', amount: 30, note: '服务费分成', method: 'cash' }),
  ]
} else {
  applicantsAll = [{ id: 'a1', case_id: 'C482', customer_id: 'S', created_at: '' }]
  plans = [
    plan({ id: 'plP', case_id: 'C482', applicant_id: 'P', referrer_total: 50 }),
    plan({ id: 'plS', case_id: 'C482', applicant_id: 'S', referrer_total: 50 }),
    plan({ id: 'plSH', case_id: 'C482', applicant_id: null }), // 共享·全案计划（applicant_id=null）
    plan({ id: 'plARCH', case_id: 'CARCH', client_total: 9999 }), // 归档案件的计划：欠款不应计入
  ]
  items = [
    // 共享·全案款项（is_shared）：政府申请费,不归任何客户,费用卡单列「共享·全案」组、计入本案净额
    item({ id: 'govFee', plan_id: 'plSH', fee_category: '政府申请费(全案)', amount_due: 500, is_shared: true, created_at: '2026-01-05' }),
    item({ id: 'lawP', plan_id: 'plP', fee_category: '律师费', amount_due: 1000, created_at: '2026-01-01' }),
    item({ id: 'copyP', plan_id: 'plP', fee_category: '文案', amount_due: 500, created_at: '2026-01-02' }),
    item({ id: 'lawS', plan_id: 'plS', fee_category: '律师费', amount_due: 1000, created_at: '2026-01-01' }),
    item({ id: 'copyS', plan_id: 'plS', fee_category: '文案', amount_due: 500, created_at: '2026-01-02' }),
    // 预支出（payable 款项，挂本案计划 plP）：付给公司 服务费分成 200，记支出后才转实际、计入净额
    item({ id: 'preCo', plan_id: 'plP', fee_category: '服务费分成', amount_due: 200, kind: 'payable', expense_direction: 'to_company', created_at: '2026-06-06' }),
  ]
  payments = [
    // 本月（2026-06）真实进账：1000 + 500 = 1500；支出 300 + 200 = 500
    pay({ id: 'shpay', applicant_id: null, plan_item_id: 'govFee', amount: 500, paid_at: '2026-06-05', is_shared: true, fee_category: '政府申请费(全案)' }), // 共享·全案收款
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
// 客户级 family（家庭成员）：Alice 名下两位——王璜(配偶,有档案→关联 Ben=S,可点跳) + 小明(子女,无档案)
seed(queryKeys.familyMembers.all, [
  { id: 'fm1', customer_id: 'P', name: '王璜', relation: '配偶', linked_customer_id: 'S', created_at: '2026-01-01' },
  { id: 'fm2', customer_id: 'P', name: '小明', relation: '子女', linked_customer_id: null, created_at: '2026-01-02' },
])
seed(queryKeys.customers.list({}), [alice, ben])
seed(queryKeys.customers.list({ search: '' }), [alice, ben]) // 客户列表页（搜索框为空时的键）
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
// 概览「临近到期」三档紧急度样本（相对 today；?due=empty 时清空验空态）。fileArch 挂归档案件 → selector 自动剔除。
const dueEmpty = params.get('due') === 'empty'
const dueDoc = (id: string, customerId: string, type: CaseDocument['doc_type'], expiry: string) =>
  doc({ id, customer_id: customerId, doc_type: type, expiry_date: expiry, storage_path: `${customerId}/general/${id}.pdf`, file_name: `${id}.pdf` })
seed(
  queryKeys.dashboard.expiringDocs,
  dueEmpty
    ? []
    : [
        dueDoc('dueRed', 'P', 'passport', '2026-06-26'), // ≤7 天 → 红
        dueDoc('dueAmber', 'S', 'medical', '2026-07-03'), // 8–14 天 → 黄
        dueDoc('dueGreen', 'P', 'medical', '2026-07-14'), // 15–30 天 → 绿
        docs.fileArch, // 探针：归档案件文件，不应出现
      ],
)
seed(queryKeys.documents.allList, [docs.fileOk, docs.fileZoe, docs.fileArch])
seed([...queryKeys.documents.all, 'archived'], [docs.fileBin])
// 待办清单（概览）：1 条随手记 + 1 条关联案件（chip 应链到 /customers/P?case=C482）
seed(queryKeys.checklist.all, [
  chk({ id: 'k1', content: '2026/6/1 Guoywfan 提名' }),
  chk({ id: 'k2', content: '蒋青霞 482 合同未签', case_id: 'C482' }),
])
// 编辑案件页（/cases/C482/edit）回填用
seed(queryKeys.cases.detail('C482'), C482)
seed(queryKeys.caseApplicants.byCase('C482'), applicantsAll.filter((a) => a.case_id === 'C482'))
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

// 职业评估案件 COA（?case=COA 选中）：阶段史 CHN学历认证 → 职业评估递交（流转记录 from→to + 里程碑日期）
seed(queryKeys.cases.detail('COA'), COA)
seed(queryKeys.caseApplicants.byCase('COA'), [])
seed(queryKeys.lodgements.byCase('COA'), []) // 职业评估无 lodgement
seed(queryKeys.records.byCase('COA'), [])
seed(queryKeys.documents.byCase('COA'), [])
seed(queryKeys.cases.stageHistory('COA'), [
  hist({ id: 'oa1', case_id: 'COA', from_stage: null, to_stage: 'oa_chn_verification', effective_at: '2026-05-12T03:00:00Z', note: '已交中国学历认证' }),
  hist({ id: 'oa2', case_id: 'COA', from_stage: 'oa_chn_verification', to_stage: 'oa_skill_submitted', effective_at: '2026-06-10T03:00:00Z', note: '技术评估已递交 VETASSESS' }),
])
// 新建未推进 OA 案件 COANEW：当前阶段「无」、阶段史空
seed(queryKeys.cases.detail('COANEW'), COANEW)
seed(queryKeys.caseApplicants.byCase('COANEW'), [])
seed(queryKeys.lodgements.byCase('COANEW'), [])
seed(queryKeys.records.byCase('COANEW'), [])
seed(queryKeys.documents.byCase('COANEW'), [])
seed(queryKeys.cases.stageHistory('COANEW'), [])

// De Facto 案件 CDF（?case=CDF 选中）：有组（参与人 Ben）、阶段史 df_prep→df_submitted（6 阶段，更新至=Submitted）
seed(queryKeys.cases.detail('CDF'), CDF)
seed(queryKeys.caseApplicants.byCase('CDF'), [{ id: 'dfA', case_id: 'CDF', customer_id: 'S', created_at: '' }])
seed(queryKeys.lodgements.byCase('CDF'), []) // De Facto 无 lodgement
seed(queryKeys.records.byCase('CDF'), [])
seed(queryKeys.documents.byCase('CDF'), [])
seed(queryKeys.cases.stageHistory('CDF'), [
  hist({ id: 'df1', case_id: 'CDF', from_stage: null, to_stage: 'df_prep', effective_at: '2026-05-15T03:00:00Z', note: '同居材料收集中' }),
  hist({ id: 'df2', case_id: 'CDF', from_stage: 'df_prep', to_stage: 'df_submitted', effective_at: '2026-06-01T03:00:00Z', note: '已递交' }),
])
// 新建未推进 DF 案件 CDFNEW：current_stage=df_prep 但阶段史空 →「更新至」行隐藏（df_prep 默认不算「更新过」）
seed(queryKeys.cases.detail('CDFNEW'), CDFNEW)
seed(queryKeys.caseApplicants.byCase('CDFNEW'), [])
seed(queryKeys.lodgements.byCase('CDFNEW'), [])
seed(queryKeys.records.byCase('CDFNEW'), [])
seed(queryKeys.documents.byCase('CDFNEW'), [])
seed(queryKeys.cases.stageHistory('CDFNEW'), [])

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
  newowner: '/referrers/new?kind=owner', // 新建归属人表单
  editreferrer: '/referrers/R1/edit', // 编辑介绍人（回填 CICI 的备注）
  oacase: '/customers/P?case=COA', // 职业评估案件（阶段进展 OA 7 阶段 + 里程碑 + 流转记录）
  oacasenew: '/customers/P?case=COANEW', // 新建未推进 OA 案件（当前阶段显示「无」）
  dfcase: '/customers/P?case=CDF', // De Facto 案件（5 阶段下拉 + 用途 + 参与客户组 + 无里程碑卡）
  dfcasenew: '/customers/P?case=CDFNEW', // 新建未推进 DF 案（df_prep 但无流转记录 →「更新至」行隐藏）
  newcasedf: '/cases/new?customer=P', // 新建案件表单（配 ?dfcat=1 预置 De Facto：去账号留组）
  customers: '/customers',
  board: '/customers?view=board',
  quick: '/customers/new', // 新建客户页（单张完整表单，组区含快速建同组人）
  newcase: '/cases/new?customer=P&with=S', // 建案表单：?with= 预选同组人（Ben）
  edit: '/customers/P/edit', // 编辑客户（完整表单，回填 Alice）
  group: '/customers/P/group', // 案件参与管理（概要带「参与案件」链入）
  editcase: '/cases/C482/edit', // 编辑案件（级联回填 482）
}

// 截图辅助：?focus=owner → 渲染后聚焦第一个归属人下拉，展开选项列表（无头截图点不了输入框）
if (params.get('focus') === 'owner') {
  window.setTimeout(() => {
    document.querySelector<HTMLInputElement>('[role="combobox"]')?.focus()
  }, 600)
}
// ?focus=menu → 展开第一个 ⋯ 操作菜单（details）；menulast → 展开最后一个（验证列表末行弹层不被裁）
if (params.get('focus') === 'menu' || params.get('focus') === 'menulast') {
  const last = params.get('focus') === 'menulast'
  window.setTimeout(() => {
    const all = document.querySelectorAll('details')
    const target = last ? all[all.length - 1] : all[0]
    target?.setAttribute('open', '')
  }, 600)
}
// ?click=<按钮文案片段> → 渲染后点击第一个匹配按钮（截图展开态用：静态截图点不了按钮）
const clickText = params.get('click')
if (clickText) {
  window.setTimeout(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes(clickText))
    btn?.click()
  }, 600)
}
// ?probe=1 → 在页角打印 scrollWidth/clientWidth，验证窄屏有无横向溢出（截图用）
if (params.get('probe')) {
  window.setTimeout(() => {
    // 把费用卡硬约束到 343px（≈ iPhone 375 减页面内边距）后量它自身有无横向溢出
    const f = document.getElementById('fees')
    let label = 'no #fees'
    if (f) {
      f.style.width = '343px'
      f.style.maxWidth = '343px'
      const card = f.querySelector('section') ?? f
      // 量所有后代里最宽的 scrollWidth（任一子元素溢出都算）
      let maxSW = card.scrollWidth
      f.querySelectorAll('*').forEach((n) => { maxSW = Math.max(maxSW, (n as HTMLElement).scrollWidth) })
      label = `@343 cardCW=${card.clientWidth} maxSW=${maxSW} ${maxSW > card.clientWidth ? 'OVERFLOW' : 'OK'}`
    }
    const el = document.scrollingElement ?? document.documentElement
    const d = document.createElement('div')
    d.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#ff0;color:#000;font-size:18px;padding:4px 8px;font-weight:700'
    d.textContent = `page SW=${el.scrollWidth} CW=${el.clientWidth} ${el.scrollWidth > el.clientWidth ? 'OVERFLOW' : 'OK'} | fees ${label}`
    document.body.appendChild(d)
  }, 1200)
}
// ?oacat=1 / ?dfcat=1 → 新建案件表单把「案件大类」设为 职业评估 / De Facto（截图条件渲染态；受控 select 走原生 setter）
const presetCat = params.get('oacat') ? '职业评估' : params.get('dfcat') ? 'De Facto 关系认定' : null
if (presetCat) {
  window.setTimeout(() => {
    const sel = [...document.querySelectorAll('select')].find(
      (s) => [...s.options].some((o) => o.value === presetCat),
    )
    if (!sel) return
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set
    setter?.call(sel, presetCat)
    sel.dispatchEvent(new Event('change', { bubbles: true }))
  }, 700)
}
// ?openstage=1 → 阶段进展：展开「推进阶段」+ 打开「切换到」FancySelect（截图 OA 7 阶段下拉用）
if (params.get('openstage')) {
  window.setTimeout(() => {
    const adv = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('推进阶段'))
    adv?.click()
  }, 600)
  window.setTimeout(() => {
    const trigger = document.querySelector<HTMLButtonElement>('button[aria-label="切换到"]')
    if (!trigger) return
    trigger.focus()
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
  }, 1000)
}
// ?fee=static|hover|touch → 费用记录行操作显隐截图态（无头截图模拟不了 :hover）：
//   static = 桌面静止（操作全隐）；hover = 首行悬停（首行操作淡入 + 浅高亮底）；touch = 触屏常显。
const feeState = params.get('fee')
if (feeState) {
  window.setTimeout(() => {
    const style = document.createElement('style')
    if (feeState === 'touch') {
      // 触屏常显 + 把费用卡顶到首屏（隐藏概要/相关案件，截图只看费用卡窄屏态）
      style.textContent =
        '.fee-row-actions{opacity:1!important;transform:none!important;pointer-events:auto!important}#summary,#cases{display:none!important}'
    } else {
      // 先全隐（模拟桌面 hover 设备静止态），hover 态再把首行单独点亮
      style.textContent = '.fee-row-actions{opacity:0!important;transform:translateX(6px)!important;pointer-events:none!important}'
    }
    document.head.appendChild(style)
    if (feeState === 'hover') {
      const firstRow = document.querySelector<HTMLElement>('.fee-row')
      if (firstRow) {
        firstRow.style.setProperty('background', '#f5faf6', 'important')
        const acts = firstRow.querySelector<HTMLElement>('.fee-row-actions')
        acts?.style.setProperty('opacity', '1', 'important')
        acts?.style.setProperty('transform', 'none', 'important')
        acts?.style.setProperty('pointer-events', 'auto', 'important')
      }
    }
  }, 700)
}
// ?opentype=1 → 打开费用卡第一个「类型」FancySelect（截图浮层展开+彩色 tag 用）；走键盘 ArrowDown 路径
if (params.get('opentype')) {
  window.setTimeout(() => {
    const btn = document.querySelector<HTMLButtonElement>('button[aria-label="录入类型"]')
    if (!btn) return
    btn.focus()
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
  }, 800)
}
// ?type=<文本> → 往归属人下拉里模拟键入（React 受控输入需走原生 setter + input 事件）
const typeText = params.get('type')
if (typeText) {
  window.setTimeout(() => {
    const input = document.querySelector<HTMLInputElement>('[role="combobox"]')
    if (!input) return
    input.focus()
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, typeText)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }, 600)
}

// 独立 harness：截「类型下拉打开态 + 收款绿/待付黄 tag + 选中勾 / 描述手填 / 一行三控件统一」用
if (page === 'fancydemo') {
  const typeOpts: FancyOption[] = [
    { value: 'received', label: '收款', tag: <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700">收款</span> },
    { value: 'owing', label: '待付', tag: <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold bg-[#f9f1df] text-[#c08a2e]">待付</span> },
  ]
  const FIELD = 'h-[38px] rounded-[10px] border border-[#eef2ef] bg-[#fbfdfc] text-[13px] text-ink outline-none transition-colors focus:border-brand/60'
  function Demo() {
    return (
      <div className="min-h-screen bg-surface-2 p-8 font-sans">
        <div className="mx-auto max-w-[560px] space-y-8 rounded-[20px] bg-white p-6 shadow-soft">
          <div>
            <p className="mb-2 font-serif text-[15px] font-bold text-ink">① 类型下拉 · 打开态（收款绿 / 待付黄 + 动画勾选）</p>
            <div className="w-[120px]">
              <FancySelect ariaLabel="录入类型" value="received" onChange={() => {}} options={typeOpts} placeholder="选择类型" defaultOpen />
            </div>
            <div className="h-28" />
          </div>
          <div>
            <p className="mb-2 font-serif text-[15px] font-bold text-ink">② 一行三控件样式统一（类型 / 描述 / 金额）</p>
            <div className="flex items-center gap-2">
              <div className="w-[96px] shrink-0">
                <FancySelect ariaLabel="录入类型" value="owing" onChange={() => {}} options={typeOpts} placeholder="选择类型" />
              </div>
              <ComboBox ariaLabel="录入描述" value="律师费（含加急）" onChange={() => {}} options={['律师费', '文案费']} placeholder="选择 / 手填" className="min-w-0 flex-1" />
              <input aria-label="款额" value="2,000.00" readOnly className={`${FIELD} w-[104px] shrink-0 px-3 text-right tabular-nums`} />
            </div>
            <p className="mt-2 text-[12px] text-faint">↑ 三控件同高(38)、同圆角(10)、同边框(#eef2ef)、同底(#fbfdfc)；描述为手填的自定义文字。</p>
          </div>
          <div>
            <p className="mb-2 font-serif text-[15px] font-bold text-ink">③ 支出列式·百分比自动算实付（付款对象/方式/金额/百分比/实付）</p>
            {/* 列头：已去掉「描述」列，付款对象占满剩余宽度 */}
            <div className="flex items-center gap-2 pb-1 text-[11px] font-medium text-faint">
              <span className="min-w-[120px] flex-1">付款对象</span>
              <span className="w-[96px] shrink-0">方式</span>
              <span className="w-[88px] shrink-0 text-right">金额</span>
              <span className="w-[64px] shrink-0 text-right">百分比</span>
              <span className="w-[96px] shrink-0 text-right">实付（AUD）</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="min-w-[120px] flex-1">
                <FancySelect ariaLabel="付款对象" value="to_company" onChange={() => {}} options={[{ value: 'to_company', label: '付给公司', tag: <span className="rounded-full bg-[var(--color-coral-bg)] px-2 py-0.5 text-[11px] font-semibold text-[#c25a52]">付给公司</span> }]} placeholder="付款对象" />
              </div>
              <div className="w-[96px] shrink-0">
                <FancySelect ariaLabel="支出方式" value="cash" onChange={() => {}} options={[{ value: 'cash', label: '现金' }]} placeholder="方式" />
              </div>
              <input aria-label="支出金额" value="100" readOnly className={`${FIELD} w-[88px] shrink-0 px-2.5 text-right tabular-nums`} />
              <input aria-label="支出百分比" value="30" readOnly className={`${FIELD} w-[64px] shrink-0 px-2 text-right tabular-nums`} />
              <div className="w-[96px] shrink-0 text-right">
                <div className="text-[13px] font-bold tabular-nums text-[#c25a52]">30.00</div>
                <div className="text-[10.5px] tabular-nums text-faint">100×30%</div>
              </div>
            </div>
            <p className="mt-2 text-[12px] text-faint">↑ 支出录入行已去掉「描述」列；实付 = 金额×百分比（100×30% = 30），留空 = 100%。★入账的是实付 30，不是基数 100★。</p>
          </div>
        </div>
      </div>
    )
  }
  createRoot(document.getElementById('root')!).render(<StrictMode><Demo /></StrictMode>)
} else
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={[ENTRY[page] ?? ENTRY.customer]}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/customers/new" element={<CustomerFormPage />} />
              <Route path="/cases/new" element={<CaseFormPage />} />
              <Route path="/customers" element={<CustomerListPage />} />
              <Route path="/customers/:id/edit" element={<CustomerFormPage />} />
              <Route path="/customers/:id/group" element={<GroupManagementPage />} />
              <Route path="/cases/:id/edit" element={<CaseFormPage />} />
              <Route path="/customers/:id" element={<CustomerDetailPage />} />
              <Route path="/finance" element={<FinancePage />} />
              <Route path="/cases" element={<CasesPage />} />
              <Route path="/storage" element={page === 'recycle' ? <RecycleBin /> : <ArchivePage />} />
              <Route path="/referrers" element={<ReferrerListPage />} />
              <Route path="/referrers/new" element={<ReferrerFormPage />} />
              <Route path="/referrers/:id/edit" element={<ReferrerFormPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  </StrictMode>,
)
