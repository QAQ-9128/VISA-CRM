import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  useArchiveCustomer,
  useCustomer,
  useCustomers,
  useDeleteCustomer,
  useSubApplicants,
  useUpdateCustomer,
} from '../../hooks/queries/useCustomers'
import { useArchiveCase, useCases, useCasesByCustomer, useAllStageHistory } from '../../hooks/queries/useCases'
import { shouldShowTrtReminder, monthsSinceGrant } from '../../lib/trt'
import {
  useAllCaseApplicants,
  useAddCaseApplicant,
  useRemoveCaseApplicant,
} from '../../hooks/queries/useCaseApplicants'
import { selectCoApplicantCases, selectJoinableCases } from '../../lib/family'
import { useFamilyLinks, useDeleteFamilyLink } from '../../hooks/queries/useFamilyLinks'
import { selectLinkedMembers, selectLinkedInto } from '../../lib/familyLinks'
import { LinkExistingCustomer } from '../../components/customers/LinkExistingCustomer'
import { formatVisaType } from '../../lib/visa'
import { useEmployer } from '../../hooks/queries/useEmployers'
import { useReferrer } from '../../hooks/queries/useReferrers'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { Avatar } from '../../components/ui/Avatar'
import { Select } from '../../components/ui/Select'
import { TrashIcon } from '../../components/ui/icons'
import { StarToggle } from '../../components/ui/StarToggle'
import { BackLink } from '../../components/ui/BackLink'
import { resolveBackLink } from '../../lib/backLink'
import { useBackSource } from '../../hooks/useBackSource'
import { LoadingBlock, ErrorBlock } from '../../components/ui/states'
import { StageBadge } from '../../components/cases/StageBadge'
import { DocumentsSection } from '../../components/documents/DocumentsSection'
import { RecordsSection } from '../../components/records/RecordsSection'
import { CustomerPaymentsSection } from '../../components/finance/CustomerPaymentsSection'
import { useCustomerDebts } from '../../hooks/queries/useCustomerDebts'
import { useCustomerFinance } from '../../hooks/queries/useCustomerFinance'
import { useChecklist } from '../../hooks/queries/useChecklist'
import { useRecordsByCustomer } from '../../hooks/queries/useRecords'
import { useDocumentsByCustomer } from '../../hooks/queries/useDocuments'
import { recordStats, sortRecords, selectPendingTasks } from '../../lib/records'
import { recentUpload } from '../../lib/documentsView'
import { computeExpiryStatus } from '../../lib/expiry'
import { CUSTOMER_PAYMENT_TEXT_CLASS } from '../../lib/finance'
import { formatMoney } from '../../lib/money'
import { CLIENT_SOURCE_LABELS, CLIENT_SOURCES, CLIENT_SOURCE_OPTION_LABELS, GENDER_LABELS } from '../../types/domain'
import { ClientSourceDot } from '../../components/customers/ClientSourceDot'
import { QuickAddFamilyMember } from '../../components/customers/QuickAddFamilyMember'
import { BriefcaseIcon, BanknoteIcon, DocIcon, ClipboardIcon, UsersIcon } from '../../components/ui/icons'
import type { ClientSource, Gender } from '../../types/domain'
import type { Case, Customer } from '../../types/models'

// 家庭成员与案件合并为一个 tab（副申/家庭只有配合案件才好用，不分开）
type CustomerTab = '概览' | '案件 / 家庭成员' | '付款' | '文件' | '记录'
const CUSTOMER_TABS: CustomerTab[] = ['概览', '案件 / 家庭成员', '付款', '文件', '记录']

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line py-2.5 last:border-0">
      <span className="shrink-0 text-sm text-muted">{label}</span>
      <span className="min-w-0 text-right text-sm text-ink">{children || '—'}</span>
    </div>
  )
}

/** 家庭组：主申请人显示其副申请人；副申请人显示其主申请人。 */
function FamilyGroup({ customer }: { customer: Customer }) {
  const subs = useSubApplicants(customer.primary_applicant_id ? undefined : customer.id)
  const primary = useCustomer(customer.primary_applicant_id ?? undefined)
  const source = useBackSource()

  if (customer.primary_applicant_id) {
    return (
      <div className="space-y-3 rounded-card bg-white p-[22px] shadow-soft">
        <p className="text-base font-bold text-ink">主申请人</p>
        {primary.data ? (
          <Link
            to={`/customers/${primary.data.id}`}
            state={source}
            className="flex items-center justify-between rounded-[12px] border border-line-2 bg-white px-3 py-2.5 text-sm hover:bg-surface-2"
          >
            <span className="font-semibold text-ink">{primary.data.full_name}</span>
            <span className="text-muted">
              {customer.relationship_to_primary || '副申请人'} ›
            </span>
          </Link>
        ) : (
          <p className="text-sm text-faint">加载中…</p>
        )}
      </div>
    )
  }

  return <FamilyGroupForPrimary customer={customer} subs={subs.data ?? []} pending={subs.isPending} />
}

/** 主申家庭区：原生副申 + 关联进来的现有客户（带「↗ 独立档案」徽章 + 移除关联）。 */
function FamilyGroupForPrimary({ customer, subs, pending }: { customer: Customer; subs: Customer[]; pending: boolean }) {
  const links = useFamilyLinks()
  const allCustomers = useCustomers({})
  const del = useDeleteFamilyLink()
  const customerById = useMemo(() => {
    const m: Record<string, Customer> = {}
    for (const c of allCustomers.data ?? []) m[c.id] = c
    return m
  }, [allCustomers.data])
  const linked = selectLinkedMembers(customer.id, links.data ?? [], customerById)
  const isEmpty = subs.length === 0 && linked.length === 0
  const source = useBackSource()

  return (
    <div className="space-y-3 rounded-card bg-white p-[22px] shadow-soft">
      <div>
        <p className="text-base font-bold text-ink">副申请人 / 家庭组成员</p>
        <p className="mt-0.5 text-[12px] text-faint">
          含两类：<span className="font-medium text-body">随主申的副申</span>（一起申请、挂靠本人）；带
          <span className="mx-1 rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand">↗ 独立档案</span>
          的是<span className="font-medium text-body">关联进来的独立客户</span>（身份不变、自己仍有档案/案件）。
        </p>
      </div>
      {pending ? (
        <p className="text-sm text-faint">加载中…</p>
      ) : isEmpty ? (
        <p className="text-sm text-faint">暂无副申请人</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[12px] border border-line-2 bg-white">
          {subs.map((s) => (
            <li key={s.id}>
              <Link to={`/customers/${s.id}`} state={source} className="flex items-center justify-between px-3 py-2.5 text-sm hover:bg-surface-2">
                <span className="font-semibold text-ink">{s.full_name}</span>
                <span className="text-muted">{s.relationship_to_primary || ''} ›</span>
              </Link>
            </li>
          ))}
          {linked.map((m) => (
            <li key={m.linkId} className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
              <Link to={`/customers/${m.customer.id}`} state={source} className="flex min-w-0 items-center gap-1.5 hover:underline">
                <span className="truncate font-semibold text-ink">{m.customer.full_name}</span>
                <span
                  title="关联进来的独立客户：身份不变、仍是顶层客户、自己的案件照常；只是同时显示在本家庭组"
                  className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand"
                >
                  ↗ 独立档案
                </span>
                {m.relationship && <span className="text-faint">{m.relationship}</span>}
              </Link>
              <button
                type="button"
                onClick={() => del.mutate(m.linkId)}
                disabled={del.isPending}
                className="shrink-0 text-xs text-faint hover:text-rose-600"
              >
                移除关联
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** 反向：该客户被关联进了哪些家庭组（任何客户都可能被别人关联为副申）。 */
function LinkedIntoSection({ customerId }: { customerId: string }) {
  const links = useFamilyLinks()
  const allCustomers = useCustomers({})
  const customerById = useMemo(() => {
    const m: Record<string, Customer> = {}
    for (const c of allCustomers.data ?? []) m[c.id] = c
    return m
  }, [allCustomers.data])
  const into = selectLinkedInto(customerId, links.data ?? [], customerById)
  const source = useBackSource()
  if (into.length === 0) return null
  return (
    <div className="space-y-3 rounded-card bg-white p-[22px] shadow-soft">
      <p className="text-base font-bold text-ink">被关联到的家庭组</p>
      <ul className="divide-y divide-line overflow-hidden rounded-[12px] border border-line-2 bg-white">
        {into.map((x) => (
          <li key={x.linkId}>
            <Link to={`/customers/${x.primary.id}`} state={source} className="flex items-center justify-between px-3 py-2.5 text-sm hover:bg-surface-2">
              <span className="font-semibold text-ink">{x.primary.full_name}</span>
              <span className="text-muted">{x.relationship || '副申请人'} ›</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** 归集欠款汇总：按 billed_to 归到该客户名下的所有案件欠款（含他不是主申请但被指定付款的案件）。 */
function BilledDebtSummary({ customerId }: { customerId: string }) {
  const debts = useCustomerDebts()
  const s = debts.summaryOf(customerId)
  if (debts.isPending) return null
  if (s.clientOwes <= 0 && s.companyOwes <= 0) return null
  return (
    <div className="rounded-card bg-rose-50/60 px-[22px] py-4 ring-1 ring-rose-100">
      <p className="text-base font-bold text-ink">归集欠款</p>
      <p className="mt-1 text-sm">
        {s.clientOwes > 0 && (
          <span className={`font-semibold ${CUSTOMER_PAYMENT_TEXT_CLASS[s.color] || 'text-rose-600'}`}>
            客户欠你 {formatMoney(s.clientOwes)}
          </span>
        )}
        {s.companyOwes > 0 && (
          <span className="ml-3 text-amber-600">欠主代理 {formatMoney(s.companyOwes)}</span>
        )}
      </p>
      <p className="mt-1 text-xs text-faint">含该客户作为「账单付款方」的所有案件（可能涵盖他不是主申请的案件）。</p>
    </div>
  )
}

/** 该客户名下的案件列表 + 新建入口 + 行内软删除 */
function CasesSection({ customerId }: { customerId: string }) {
  const cases = useCasesByCustomer(customerId)
  const archive = useArchiveCase()

  function handleDelete(cs: Case) {
    const label = `${formatVisaType(cs.visa_subclass, cs.visa_stream)} 签证`
    if (!window.confirm(`确认删除案件「${label}」？归档后从列表消失，可随时恢复。`)) return
    archive.mutate(cs.id)
  }

  return (
    <div className="space-y-3 rounded-card bg-white p-[22px] shadow-soft">
      <div className="flex items-center justify-between">
        <p className="text-base font-bold text-ink">案件</p>
        <Link to={`/cases/new?customer=${customerId}`}>
          <Button variant="secondary">+ 新建案件</Button>
        </Link>
      </div>
      {cases.isPending ? (
        <p className="text-sm text-faint">加载中…</p>
      ) : cases.data && cases.data.length > 0 ? (
        <ul className="divide-y divide-line overflow-hidden rounded-[12px] border border-line-2 bg-white">
          {cases.data.map((cs) => (
            <li key={cs.id} className="flex items-center hover:bg-surface-2">
              <Link
                to={`/cases/${cs.id}`}
                state={{ from: 'customer', customerId }}
                className="flex flex-1 items-center justify-between py-2.5 pr-2 pl-3 text-sm"
              >
                <span className="font-semibold text-ink">{formatVisaType(cs.visa_subclass, cs.visa_stream)} 签证</span>
                <span className="flex items-center gap-2">
                  <StageBadge stage={cs.current_stage} />
                  <span className="text-line-2">›</span>
                </span>
              </Link>
              <button
                type="button"
                title="删除案件（软删，可恢复）"
                aria-label="删除案件"
                disabled={archive.isPending}
                onClick={() => handleDelete(cs)}
                className="flex min-h-11 items-center gap-1 px-3 text-xs text-faint hover:text-rose-600 disabled:opacity-50"
              >
                <TrashIcon className="size-4" />
                删除
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-faint">暂无案件</p>
      )}
    </div>
  )
}

/** 该客户作为「副申请」参与的案件（含别人主申的 case）：可加入同家庭组的案件、可移除。 */
function CoApplicantCasesSection({ customerId }: { customerId: string }) {
  const cases = useCases()
  const applicants = useAllCaseApplicants()
  const customers = useCustomers({})
  const links = useFamilyLinks()
  const add = useAddCaseApplicant()
  const remove = useRemoveCaseApplicant()
  const [selected, setSelected] = useState('')

  const customerById = useMemo(() => {
    const m: Record<string, Customer> = {}
    for (const c of customers.data ?? []) m[c.id] = c
    return m
  }, [customers.data])

  const joined = useMemo(
    () => selectCoApplicantCases(cases.data ?? [], applicants.data ?? [], customerId),
    [cases.data, applicants.data, customerId],
  )
  const joinable = useMemo(
    () => selectJoinableCases(cases.data ?? [], applicants.data ?? [], customerId, customers.data ?? [], links.data ?? []),
    [cases.data, applicants.data, customerId, customers.data, links.data],
  )

  if (cases.isPending || applicants.isPending || customers.isPending) return null
  // 既没参与、也没有可加入的同组案件 → 不展示该区块（无可操作内容）
  if (joined.length === 0 && joinable.length === 0) return null

  const caseLabel = (c: Case) =>
    `${customerById[c.customer_id]?.full_name ?? '—'} · ${formatVisaType(c.visa_subclass, c.visa_stream)}`

  return (
    <div className="space-y-3 rounded-card bg-white p-[22px] shadow-soft">
      <div>
        <p className="text-base font-bold text-ink">作为副申请参与的案件</p>
        <p className="mt-0.5 text-[12px] text-faint">本人作为副申加入的「具体案件」（按案件参与，影响该案账单拆分）——与上面的家庭组是两回事。</p>
      </div>

      {joined.length > 0 ? (
        <ul className="divide-y divide-line overflow-hidden rounded-[12px] border border-line-2 bg-white">
          {joined.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
              <Link
                to={`/cases/${c.id}`}
                state={{ from: 'customer', customerId }}
                className="flex min-w-0 items-center gap-2 hover:underline"
              >
                <span className="truncate font-semibold text-ink">{caseLabel(c)}</span>
                <StageBadge stage={c.current_stage} />
              </Link>
              <button
                type="button"
                onClick={() => remove.mutate({ caseId: c.id, customerId })}
                disabled={remove.isPending}
                className="shrink-0 text-xs text-faint hover:text-rose-600"
              >
                移除
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-faint">暂未作为副申请参与其他案件</p>
      )}

      {joinable.length > 0 && (
        <div className="flex items-end gap-2 pt-1">
          <div className="flex-1">
            <Select
              label=""
              placeholder="选择要加入的案件…"
              options={joinable.map((c) => ({ value: c.id, label: caseLabel(c) }))}
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            />
          </div>
          <Button
            variant="secondary"
            disabled={!selected || add.isPending}
            onClick={() =>
              add.mutate({ caseId: selected, customerId }, { onSuccess: () => setSelected('') })
            }
          >
            {add.isPending ? '加入中…' : '加入'}
          </Button>
        </div>
      )}
    </div>
  )
}

/** KPI 横条：统计的唯一来源（5 项竖线分隔），全部复用现有 selector。 */
function CustomerKpiBar({ customer }: { customer: Customer }) {
  const cases = useCasesByCustomer(customer.id)
  const debts = useCustomerDebts()
  const checklist = useChecklist()
  const records = useRecordsByCustomer(customer.id)
  const subs = useSubApplicants(customer.primary_applicant_id ? undefined : customer.id)
  const links = useFamilyLinks()
  const allCustomers = useCustomers({})
  const customerById = useMemo(() => {
    const m: Record<string, Customer> = {}
    for (const c of allCustomers.data ?? []) m[c.id] = c
    return m
  }, [allCustomers.data])

  const activeCases = (cases.data ?? []).length
  const owe = Math.max(0, debts.summaryOf(customer.id).clientOwes)
  const pendingDocs = (checklist.data ?? []).filter(
    (i) => i.customer_id === customer.id && !i.case_id && !i.is_done,
  ).length
  const recordCount = recordStats(records.data ?? []).total
  const linked = customer.primary_applicant_id
    ? []
    : selectLinkedMembers(customer.id, links.data ?? [], customerById)
  const familyCount = (subs.data?.length ?? 0) + linked.length

  const items = [
    { tone: 'bg-brand-50 text-brand', icon: <BriefcaseIcon className="size-[18px]" />, label: '活跃案件', value: String(activeCases) },
    { tone: 'bg-amber-50 text-amber-600', icon: <BanknoteIcon className="size-[18px]" />, label: '待收款', value: formatMoney(owe) },
    { tone: 'bg-rose-50 text-rose-600', icon: <DocIcon className="size-[18px]" />, label: '待补文件', value: String(pendingDocs) },
    { tone: 'bg-violet-50 text-violet-600', icon: <ClipboardIcon className="size-[18px]" />, label: '最近记录', value: String(recordCount) },
    { tone: 'bg-emerald-50 text-emerald-600', icon: <UsersIcon className="size-[18px]" />, label: '家庭成员', value: String(familyCount) },
  ]
  return (
    <Card pad={false}>
      <div className="flex flex-wrap divide-x divide-line">
        {items.map((it) => (
          <div key={it.label} className="flex min-w-[7.5rem] flex-1 items-center gap-3 px-5 py-4">
            <span className={`grid size-9 shrink-0 place-items-center rounded-[11px] ${it.tone}`}>{it.icon}</span>
            <div className="min-w-0">
              <div className="text-[12px] text-muted">{it.label}</div>
              <div className="truncate text-[18px] font-bold tabular-nums text-ink">{it.value}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

/**
 * 财务摘要（概览 tab 用）：总应收 / 已收 / 未收 + 「查看付款详情」(→付款 tab)。
 * 客户级、跨案件归集；归集欠款 / #5 逻辑不动。完整付款区在「付款」tab 的 CustomerPaymentsSection。
 */
function FinanceSummary({
  customerId,
  onViewDetail,
}: {
  customerId: string
  onViewDetail?: () => void
}) {
  const f = useCustomerFinance(customerId)
  const t = f.receivableTotals
  const hasCases = !f.isPending && !f.isError && f.receivables.length > 0

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-base font-bold text-ink">财务摘要</p>
        {onViewDetail && (
          <button type="button" onClick={onViewDetail} className="text-[13px] font-semibold text-brand hover:text-brand-600">
            查看付款详情 ›
          </button>
        )}
      </div>
      {f.isPending ? (
        <p className="text-sm text-faint">加载付款数据…</p>
      ) : !hasCases ? (
        <p className="text-sm text-faint">该客户暂无案件，先到「案件」建一个案件再记账。</p>
      ) : (
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { label: '总应收', value: formatMoney(t.receivable), cls: 'text-ink' },
            { label: '已收', value: formatMoney(t.paid), cls: 'text-emerald-600' },
            { label: '未收', value: formatMoney(t.unpaid), cls: 'text-rose-600' },
          ].map((m) => (
            <div key={m.label} className="rounded-[12px] bg-surface-2 px-3 py-2.5">
              <div className="text-[11.5px] text-muted">{m.label}</div>
              <div className={`mt-0.5 text-[15px] font-bold tabular-nums ${m.cls}`}>{m.value}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

/** 概览·基本信息摘要（复用 DetailRow；编辑→edit 页）。 */
function BasicInfoCard({ c, employerName, referrerName }: { c: Customer; employerName: string | null; referrerName: string | null }) {
  return (
    <Card>
      <div className="mb-1 flex items-center justify-between">
        <p className="text-base font-bold text-ink">基本信息</p>
        <Link to={`/customers/${c.id}/edit`} className="text-[13px] font-semibold text-brand hover:text-brand-600">编辑 ›</Link>
      </div>
      <div className="-mb-2.5">
        <DetailRow label="生日">{c.birth_date}</DetailRow>
        <DetailRow label="性别">{c.gender ? GENDER_LABELS[c.gender as Gender] ?? c.gender : null}</DetailRow>
        <DetailRow label="客户来源">
          {c.client_source ? (
            <span className="inline-flex items-center gap-1.5">
              <ClientSourceDot source={c.client_source} />
              {CLIENT_SOURCE_LABELS[c.client_source as ClientSource] ?? c.client_source}
            </span>
          ) : null}
        </DetailRow>
        <DetailRow label="担保雇主">
          {c.sponsor_employer_id ? (
            <Link to={`/employers/${c.sponsor_employer_id}/edit`} className="text-brand hover:underline">{employerName ?? '…'}</Link>
          ) : null}
        </DetailRow>
        <DetailRow label="担保职位">{c.sponsor_position}</DetailRow>
        <DetailRow label="介绍人">
          {c.referrer_id ? (
            <Link to={`/referrers/${c.referrer_id}/edit`} className="text-brand hover:underline">{referrerName ?? '…'}</Link>
          ) : null}
        </DetailRow>
        <DetailRow label="备注">{c.notes}</DetailRow>
      </div>
    </Card>
  )
}

/** 概览·案件摘要（前几条 + 新建 + 全部→案件 tab）。复用 useCasesByCustomer。 */
function CasesSummaryCard({ customerId, onGoCases }: { customerId: string; onGoCases: () => void }) {
  const cases = useCasesByCustomer(customerId)
  const list = (cases.data ?? []).slice(0, 3)
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-base font-bold text-ink">案件</p>
        <div className="flex items-center gap-2.5 text-[13px] font-semibold text-brand">
          <Link to={`/cases/new?customer=${customerId}`} className="hover:text-brand-600">+ 新建案件</Link>
          <button type="button" onClick={onGoCases} className="hover:text-brand-600">全部 ›</button>
        </div>
      </div>
      {cases.isPending ? (
        <p className="text-sm text-faint">加载中…</p>
      ) : list.length === 0 ? (
        <p className="rounded-[12px] border border-dashed border-line-2 px-3 py-3 text-sm text-faint">暂无案件 · 点「新建案件」创建</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[12px] border border-line-2">
          {list.map((cs) => (
            <li key={cs.id}>
              <Link to={`/cases/${cs.id}`} state={{ from: 'customer', customerId }} className="flex items-center justify-between px-3 py-2.5 text-sm hover:bg-surface-2">
                <span className="font-semibold text-ink">{formatVisaType(cs.visa_subclass, cs.visa_stream)} 签证</span>
                <span className="flex items-center gap-2"><StageBadge stage={cs.current_stage} /><span className="text-line-2">›</span></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/** 副申请人 / 家庭成员区（成员列表 + 三按钮 + 被关联到的家庭组）。概览与家庭 tab 共用同一套 flow。 */
function FamilyMembersSection({ c, onManage }: { c: Customer; onManage?: () => void }) {
  return (
    <div className="space-y-3">
      <div className="relative">
        <FamilyGroup customer={c} />
        {onManage && (
          <button type="button" onClick={onManage} className="absolute right-[22px] top-[22px] text-[13px] font-semibold text-brand hover:text-brand-600">
            管理 ›
          </button>
        )}
      </div>
      {/* 三个按钮：仅主申可加；与概览同一套 flow，关联逻辑不动。分两类说明用途。 */}
      {!c.primary_applicant_id && (
        <div className="space-y-3 rounded-[14px] border border-line-2 bg-surface-2/60 p-3.5">
          <div>
            <p className="text-[12px] font-semibold text-muted">新建副申（随主申一起申请，挂靠到本人名下）</p>
            <div className="mt-1.5 flex flex-wrap items-start gap-3">
              <Link to={`/customers/new?primary=${c.id}`}>
                <Button variant="secondary">+ 添加副申请人</Button>
              </Link>
              <QuickAddFamilyMember customer={c} />
            </div>
            <p className="mt-1 text-[11.5px] text-faint">「添加副申请人」走完整表单；「一键添加」只填 姓名/性别/生日/关系，快速建一条挂靠本人的客户。</p>
          </div>
          <div className="border-t border-line-2 pt-3">
            <p className="text-[12px] font-semibold text-muted">关联已有客户（对方仍是独立客户，身份不变）</p>
            <div className="mt-1.5">
              <LinkExistingCustomer primaryId={c.id} />
            </div>
            <p className="mt-1 text-[11.5px] text-faint">把一个已存在的独立客户关联进本家庭组，只用于一起查看 / 管理；不改对方身份，不影响其案件 / 账单。</p>
          </div>
        </div>
      )}
      <LinkedIntoSection customerId={c.id} />
    </div>
  )
}

/** 概览·最近记录摘要（前几条 + 查看全部/添加→记录 tab）。复用记录 hook + sortRecords。 */
function RecentRecordsSummary({ customerId, onGoRecords }: { customerId: string; onGoRecords: () => void }) {
  const records = useRecordsByCustomer(customerId)
  const list = useMemo(() => sortRecords(records.data ?? []).slice(0, 3), [records.data])
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-base font-bold text-ink">最近记录</p>
        <button type="button" onClick={onGoRecords} className="text-[13px] font-semibold text-brand hover:text-brand-600">查看全部 / 添加 ›</button>
      </div>
      {records.isPending ? (
        <p className="text-sm text-faint">加载中…</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-faint">暂无记录</p>
      ) : (
        <ul className="space-y-2.5">
          {list.map((r) => (
            <li key={r.id} className="flex items-start gap-2">
              <span aria-hidden>{r.type === 'task' ? '☑️' : r.emoji_marker || '💬'}</span>
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${r.type === 'task' && r.is_done ? 'text-faint line-through' : 'text-body'}`}>{r.content}</p>
                <p className="text-xs text-faint">{r.type === 'task' ? '待办' : '跟进'}{r.due_date ? ` · 截止 ${r.due_date}` : ''}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/** 概览·文件摘要（数量 + 最近上传 + 查看/上传→文件 tab）。复用文件 hook。 */
function DocsSummary({ customerId, onGoDocs }: { customerId: string; onGoDocs: () => void }) {
  const docs = useDocumentsByCustomer(customerId)
  const data = docs.data ?? []
  const recent = recentUpload(data)
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-base font-bold text-ink">文件</p>
        <button type="button" onClick={onGoDocs} className="text-[13px] font-semibold text-brand hover:text-brand-600">查看 / 上传 ›</button>
      </div>
      <p className="text-[12.5px] text-faint">共 {data.length} 个{recent ? ` · 最近上传 ${recent.date}` : ''}</p>
      {data.length === 0 && <p className="mt-2 text-sm text-faint">暂无文件</p>}
    </Card>
  )
}

/** 概览·下一步/提醒：TRT + 待跟进待办 + 到期文件，全部真实派生；都为空 → 空态，不造假。 */
function NextStepsSummary({ customerId, trtTriggered, trtMonths }: { customerId: string; trtTriggered: boolean; trtMonths: number }) {
  const records = useRecordsByCustomer(customerId)
  const docs = useDocumentsByCustomer(customerId)
  const pending = useMemo(() => selectPendingTasks(records.data ?? []).slice(0, 5), [records.data])
  const expiring = useMemo(
    () =>
      (docs.data ?? [])
        .map((d) => ({ d, info: computeExpiryStatus(d.expiry_date) }))
        .filter((x) => x.info && x.info.status !== 'ok')
        .slice(0, 3),
    [docs.data],
  )
  const empty = !trtTriggered && pending.length === 0 && expiring.length === 0
  return (
    <Card>
      <p className="mb-3 text-base font-bold text-ink">下一步 / 提醒</p>
      {empty ? (
        <p className="text-sm text-faint">暂无待办提醒</p>
      ) : (
        <ul className="space-y-2.5 text-sm">
          {trtTriggered && (
            <li className="flex items-start gap-2 text-amber-800"><span aria-hidden>⚠️</span><span>可办 186 TRT 永居（下签 {trtMonths} 个月）</span></li>
          )}
          {pending.map((t) => (
            <li key={t.id} className="flex items-start gap-2 text-body">
              <span aria-hidden>☑️</span>
              <span className="min-w-0">{t.content}{t.due_date && <span className="text-xs text-faint"> · 截止 {t.due_date}</span>}</span>
            </li>
          ))}
          {expiring.map((x) => (
            <li key={x.d.id} className="flex items-start gap-2 text-body">
              <span aria-hidden>📎</span>
              <span className="min-w-0">
                {x.d.title || x.d.file_name || '文件'}
                <span className={`text-xs ${x.info!.status === 'overdue' ? 'text-rose-600' : 'text-amber-700'}`}>
                  {' '}· {x.info!.status === 'overdue' ? `已过期 ${Math.abs(x.info!.daysRemaining)} 天` : `${x.info!.daysRemaining} 天后到期`}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export function CustomerDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const query = useCustomer(id)
  const update = useUpdateCustomer()
  const archive = useArchiveCustomer()
  const del = useDeleteCustomer()
  const employer = useEmployer(query.data?.sponsor_employer_id)
  const referrer = useReferrer(query.data?.referrer_id)
  const trtCases = useCasesByCustomer(query.data?.id)
  const allStageHistory = useAllStageHistory()
  // 副申客户：取其主申用于头部「主申:<姓名>」链接（无主申则 hook 自动停用）
  const primaryCust = useCustomer(query.data?.primary_applicant_id ?? undefined)
  const headerSource = useBackSource()
  const [tab, setTab] = useState<CustomerTab>('概览')

  if (query.isPending) return <LoadingBlock />
  if (query.isError) return <ErrorBlock error={query.error} />
  if (!query.data) {
    return (
      <div className="mx-auto max-w-2xl text-center text-muted">
        客户不存在或已被删除。
        <div className="mt-4">
          <Link to="/customers" className="text-brand hover:underline">
            返回客户列表
          </Link>
        </div>
      </div>
    )
  }

  const c = query.data

  const trtCase = (trtCases.data ?? []).find((cs) =>
    shouldShowTrtReminder(cs, trtCases.data ?? [], allStageHistory.data ?? []),
  )
  const trtTriggered = !!trtCase
  const trtMonths = trtCase
    ? monthsSinceGrant((allStageHistory.data ?? []).filter((h) => h.case_id === trtCase.id), new Date()) ?? 0
    : 0

  function handleArchive() {
    if (!window.confirm(`确定归档「${c.full_name}」吗？归档后默认不显示，可随时恢复。`)) return
    archive.mutate(c.id, { onSuccess: () => navigate('/customers') })
  }

  function handleDelete() {
    if (
      !window.confirm(
        `彻底删除「${c.full_name}」？\n\n将连同其名下所有案件、递交记录、文件、账目、跟进/待办一并【永久删除，不可恢复】！\n如只想暂时隐藏，请用「归档」。`,
      )
    )
      return
    del.mutate(c.id, { onSuccess: () => navigate('/customers') })
  }

  const back = resolveBackLink(location.state, { to: '/customers', label: '返回客户列表' })
  const isSub = !!c.primary_applicant_id

  return (
    <section className="mx-auto max-w-6xl space-y-5">
      {/* 头部 */}
      <BackLink to={back.to} label={back.label} />
      <Card>
        <div className="flex items-start gap-4">
          <Avatar name={c.full_name} seed={c.id} size={56} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">{c.full_name}</h1>
              <ClientSourceDot source={c.client_source} size="md" />
              {trtTriggered && <Badge className="bg-amber-100 text-amber-800">⚠️ 可办 186 TRT</Badge>}
              {c.is_archived && <Badge className="bg-slate-200 text-slate-600">已归档</Badge>}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted">
              {c.gender && <span>{GENDER_LABELS[c.gender as Gender] ?? c.gender}</span>}
              <span className="text-faint">客户ID {c.id.slice(0, 8)}</span>
              <span className="inline-flex items-center gap-1.5">
                来源
                <select
                  aria-label="客户来源"
                  value={c.client_source ?? ''}
                  disabled={update.isPending}
                  onChange={(e) => update.mutate({ id: c.id, patch: { client_source: e.target.value || null } })}
                  className="rounded-lg border border-line-2 bg-white px-2 py-1 text-xs text-ink outline-none focus:border-brand"
                >
                  <option value="">未分类</option>
                  {CLIENT_SOURCES.map((s) => (
                    <option key={s} value={s}>{CLIENT_SOURCE_OPTION_LABELS[s]}</option>
                  ))}
                </select>
              </span>
              {isSub && (
                <span className="inline-flex items-center gap-1.5">
                  <Badge className="bg-violet-50 text-violet-700">副申</Badge>
                  {primaryCust.data && (
                    <Link to={`/customers/${primaryCust.data.id}`} state={headerSource} className="font-medium text-brand hover:underline">
                      主申：{primaryCust.data.full_name}
                    </Link>
                  )}
                </span>
              )}
            </div>
            {(c.phone || c.email) && (
              <p className="mt-1 truncate text-sm text-faint">{[c.phone, c.email].filter(Boolean).join(' · ')}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <StarToggle
              starred={c.is_starred}
              disabled={update.isPending}
              onToggle={() => update.mutate({ id: c.id, patch: { is_starred: !c.is_starred } })}
              size={24}
            />
            <Link to={`/customers/${c.id}/edit`}>
              <Button>编辑客户</Button>
            </Link>
          </div>
        </div>
      </Card>

      {/* 顶部 tab（与案件详情同款） */}
      <div className="flex gap-1 overflow-x-auto border-b border-line">
        {CUSTOMER_TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`shrink-0 border-b-2 px-3.5 py-2.5 text-sm font-semibold transition-colors ${
              tab === t ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-body'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ① 概览：仅摘要 + 入口 */}
      {tab === '概览' && (
        <div className="space-y-5">
          <CustomerKpiBar customer={c} />
          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
            <div className="space-y-5">
              <BasicInfoCard c={c} employerName={employer.data?.name ?? null} referrerName={referrer.data?.name ?? null} />
              <CasesSummaryCard customerId={c.id} onGoCases={() => setTab('案件 / 家庭成员')} />
              {/* 作为副申参与的案件：无内容时自动隐藏 */}
              <CoApplicantCasesSection customerId={c.id} />
              <FamilyMembersSection c={c} onManage={() => setTab('案件 / 家庭成员')} />
            </div>
            <div className="space-y-5">
              <FinanceSummary customerId={c.id} onViewDetail={() => setTab('付款')} />
              <RecentRecordsSummary customerId={c.id} onGoRecords={() => setTab('记录')} />
              <DocsSummary customerId={c.id} onGoDocs={() => setTab('文件')} />
              <NextStepsSummary customerId={c.id} trtTriggered={trtTriggered} trtMonths={trtMonths} />
            </div>
          </div>
        </div>
      )}

      {/* ② 案件 / 家庭成员（合并：案件 + 副申参与的案件 + 家庭成员管理，配合使用） */}
      {tab === '案件 / 家庭成员' && (
        <div className="space-y-5">
          <CasesSection customerId={c.id} />
          <CoApplicantCasesSection customerId={c.id} />
          <FamilyMembersSection c={c} />
        </div>
      )}

      {/* ③ 付款（客户级跨案件归集；双流 + 归集欠款 + 记一笔） */}
      {tab === '付款' && (
        <div className="space-y-5">
          <BilledDebtSummary customerId={c.id} />
          <CustomerPaymentsSection customerId={c.id} />
        </div>
      )}

      {/* ④ 文件（完整） */}
      {tab === '文件' && <DocumentsSection customerId={c.id} variant="full" />}

      {/* ⑤ 记录（完整） */}
      {tab === '记录' && <RecordsSection customerId={c.id} variant="full" />}

      {/* 底部：归档 / 彻底删除 */}
      <div className="flex gap-3 border-t border-line pt-4">
        <Button variant="ghost" onClick={handleArchive} disabled={archive.isPending}>
          {c.is_archived ? '已归档' : '归档'}
        </Button>
        <Button variant="ghost" onClick={handleDelete} disabled={del.isPending} className="text-rose-600 hover:bg-rose-50">
          {del.isPending ? '删除中…' : '彻底删除'}
        </Button>
      </div>
    </section>
  )
}
