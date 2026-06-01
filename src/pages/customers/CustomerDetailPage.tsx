import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  useArchiveCustomer,
  useCustomer,
  useCustomers,
  useDeleteCustomer,
  useSubApplicants,
  useUpdateCustomer,
} from '../../hooks/queries/useCustomers'
import { useArchiveCase, useCases, useCasesByCustomer, useAllStageHistory } from '../../hooks/queries/useCases'
import { shouldShowTrtReminder } from '../../lib/trt'
import {
  useAllCaseApplicants,
  useAddCaseApplicant,
  useRemoveCaseApplicant,
} from '../../hooks/queries/useCaseApplicants'
import { selectCoApplicantCases, selectJoinableCases } from '../../lib/family'
import { formatVisaType } from '../../lib/visa'
import { useEmployer } from '../../hooks/queries/useEmployers'
import { useReferrer } from '../../hooks/queries/useReferrers'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Select } from '../../components/ui/Select'
import { TrashIcon } from '../../components/ui/icons'
import { StarToggle } from '../../components/ui/StarToggle'
import { BackLink } from '../../components/ui/BackLink'
import { LoadingBlock, ErrorBlock } from '../../components/ui/states'
import { StageBadge } from '../../components/cases/StageBadge'
import { DocumentsSection } from '../../components/documents/DocumentsSection'
import { RecordsSection } from '../../components/records/RecordsSection'
import { CustomerPaymentsSection } from '../../components/finance/CustomerPaymentsSection'
import { useCustomerDebts } from '../../hooks/queries/useCustomerDebts'
import { CUSTOMER_PAYMENT_TEXT_CLASS } from '../../lib/finance'
import { formatMoney } from '../../lib/money'
import { CLIENT_SOURCE_LABELS, GENDER_LABELS } from '../../types/domain'
import { ClientSourceDot } from '../../components/customers/ClientSourceDot'
import { QuickAddFamilyMember } from '../../components/customers/QuickAddFamilyMember'
import type { ClientSource, Gender } from '../../types/domain'
import type { Case, Customer } from '../../types/models'

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2.5 last:border-0">
      <span className="shrink-0 text-sm text-slate-500">{label}</span>
      <span className="min-w-0 text-right text-sm text-slate-900">{children || '—'}</span>
    </div>
  )
}

/** 家庭组：主申请人显示其副申请人；副申请人显示其主申请人。 */
function FamilyGroup({ customer }: { customer: Customer }) {
  const subs = useSubApplicants(customer.primary_applicant_id ? undefined : customer.id)
  const primary = useCustomer(customer.primary_applicant_id ?? undefined)

  if (customer.primary_applicant_id) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-slate-500">主申请人</p>
        {primary.data ? (
          <Link
            to={`/customers/${primary.data.id}`}
            className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm hover:bg-slate-50"
          >
            <span className="font-medium text-slate-900">{primary.data.full_name}</span>
            <span className="text-slate-500">
              {customer.relationship_to_primary || '副申请人'} ›
            </span>
          </Link>
        ) : (
          <p className="text-sm text-slate-400">加载中…</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-500">副申请人 / 家庭组成员</p>
      {subs.isPending ? (
        <p className="text-sm text-slate-400">加载中…</p>
      ) : subs.data && subs.data.length > 0 ? (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {subs.data.map((s) => (
            <li key={s.id}>
              <Link
                to={`/customers/${s.id}`}
                className="flex items-center justify-between px-3 py-2.5 text-sm hover:bg-slate-50"
              >
                <span className="font-medium text-slate-900">{s.full_name}</span>
                <span className="text-slate-500">{s.relationship_to_primary || ''} ›</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-400">暂无副申请人</p>
      )}
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
    <div className="rounded-xl border border-rose-200 bg-rose-50/50 px-4 py-3">
      <p className="text-sm font-medium text-slate-700">归集欠款</p>
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
      <p className="mt-1 text-xs text-slate-400">含该客户作为「账单付款方」的所有案件（可能涵盖他不是主申请的案件）。</p>
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
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">案件</p>
        <Link to={`/cases/new?customer=${customerId}`}>
          <Button variant="secondary">+ 新建案件</Button>
        </Link>
      </div>
      {cases.isPending ? (
        <p className="text-sm text-slate-400">加载中…</p>
      ) : cases.data && cases.data.length > 0 ? (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {cases.data.map((cs) => (
            <li key={cs.id} className="flex items-center hover:bg-slate-50">
              <Link
                to={`/cases/${cs.id}`}
                state={{ from: 'customer', customerId }}
                className="flex flex-1 items-center justify-between py-2.5 pr-2 pl-3 text-sm"
              >
                <span className="font-medium text-slate-900">{formatVisaType(cs.visa_subclass, cs.visa_stream)} 签证</span>
                <span className="flex items-center gap-2">
                  <StageBadge stage={cs.current_stage} />
                  <span className="text-slate-300">›</span>
                </span>
              </Link>
              <button
                type="button"
                title="删除案件（软删，可恢复）"
                aria-label="删除案件"
                disabled={archive.isPending}
                onClick={() => handleDelete(cs)}
                className="flex min-h-11 items-center gap-1 px-3 text-xs text-slate-400 hover:text-rose-600 disabled:opacity-50"
              >
                <TrashIcon className="size-4" />
                删除
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-400">暂无案件</p>
      )}
    </div>
  )
}

/** 该客户作为「副申请」参与的案件（含别人主申的 case）：可加入同家庭组的案件、可移除。 */
function CoApplicantCasesSection({ customerId }: { customerId: string }) {
  const cases = useCases()
  const applicants = useAllCaseApplicants()
  const customers = useCustomers({})
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
    () => selectJoinableCases(cases.data ?? [], applicants.data ?? [], customerId, customers.data ?? []),
    [cases.data, applicants.data, customerId, customers.data],
  )

  if (cases.isPending || applicants.isPending || customers.isPending) return null
  // 既没参与、也没有可加入的同组案件 → 不展示该区块（无可操作内容）
  if (joined.length === 0 && joinable.length === 0) return null

  const caseLabel = (c: Case) =>
    `${customerById[c.customer_id]?.full_name ?? '—'} · ${formatVisaType(c.visa_subclass, c.visa_stream)}`

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-500">作为副申请参与的案件</p>

      {joined.length > 0 ? (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {joined.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
              <Link
                to={`/cases/${c.id}`}
                state={{ from: 'customer', customerId }}
                className="flex min-w-0 items-center gap-2 hover:underline"
              >
                <span className="truncate font-medium text-slate-900">{caseLabel(c)}</span>
                <StageBadge stage={c.current_stage} />
              </Link>
              <button
                type="button"
                onClick={() => remove.mutate({ caseId: c.id, customerId })}
                disabled={remove.isPending}
                className="shrink-0 text-xs text-slate-400 hover:text-rose-600"
              >
                移除
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-400">暂未作为副申请参与其他案件</p>
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

export function CustomerDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const query = useCustomer(id)
  const update = useUpdateCustomer()
  const archive = useArchiveCustomer()
  const del = useDeleteCustomer()
  const employer = useEmployer(query.data?.sponsor_employer_id)
  const referrer = useReferrer(query.data?.referrer_id)
  const trtCases = useCasesByCustomer(query.data?.id)
  const allStageHistory = useAllStageHistory()

  if (query.isPending) return <LoadingBlock />
  if (query.isError) return <ErrorBlock error={query.error} />
  if (!query.data) {
    return (
      <div className="mx-auto max-w-2xl text-center text-slate-500">
        客户不存在或已被删除。
        <div className="mt-4">
          <Link to="/customers" className="text-indigo-600 hover:underline">
            返回客户列表
          </Link>
        </div>
      </div>
    )
  }

  const c = query.data

  const trtTriggered = (trtCases.data ?? []).some((cs) =>
    shouldShowTrtReminder(cs, trtCases.data ?? [], allStageHistory.data ?? []),
  )

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

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <BackLink to="/customers" label="客户列表" />

      <div className="flex items-start gap-2">
        <StarToggle
          starred={c.is_starred}
          disabled={update.isPending}
          onToggle={() => update.mutate({ id: c.id, patch: { is_starred: !c.is_starred } })}
          size={24}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">{c.full_name}</h1>
            <ClientSourceDot source={c.client_source} size="md" />
            {trtTriggered && <Badge className="bg-amber-100 text-amber-800">⚠️ 可办 186 TRT</Badge>}
            {c.is_archived && <Badge className="bg-gray-200 text-gray-600">已归档</Badge>}
          </div>
        </div>
        <Link to={`/customers/${c.id}/edit`}>
          <Button variant="secondary">编辑</Button>
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white px-4 py-2">
        <DetailRow label="生日">{c.birth_date}</DetailRow>
        <DetailRow label="性别">
          {c.gender ? GENDER_LABELS[c.gender as Gender] ?? c.gender : null}
        </DetailRow>
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
            <Link to={`/employers/${c.sponsor_employer_id}/edit`} className="text-indigo-600 hover:underline">
              {employer.data?.name ?? '…'}
            </Link>
          ) : null}
        </DetailRow>
        <DetailRow label="担保职位">{c.sponsor_position}</DetailRow>
        <DetailRow label="介绍人">
          {c.referrer_id ? (
            <Link to={`/referrers/${c.referrer_id}/edit`} className="text-indigo-600 hover:underline">
              {referrer.data?.name ?? '…'}
            </Link>
          ) : null}
        </DetailRow>
        <DetailRow label="备注">{c.notes}</DetailRow>
      </div>

      <CasesSection customerId={c.id} />

      <CoApplicantCasesSection customerId={c.id} />

      <BilledDebtSummary customerId={c.id} />

      <CustomerPaymentsSection customerId={c.id} />

      <DocumentsSection customerId={c.id} />

      <RecordsSection customerId={c.id} />

      <FamilyGroup customer={c} />

      {/* 家庭组成员操作：完整流程（+ 添加副申请人）与轻量入口（+ 一键添加家庭成员）并排 */}
      <div className="flex flex-wrap items-start gap-3">
        {!c.primary_applicant_id && (
          <Link to={`/customers/new?primary=${c.id}`}>
            <Button variant="secondary">+ 添加副申请人</Button>
          </Link>
        )}
        <QuickAddFamilyMember customer={c} />
      </div>

      <div className="flex gap-3 pt-2">
        <Button variant="ghost" onClick={handleArchive} disabled={archive.isPending}>
          {c.is_archived ? '已归档' : '归档'}
        </Button>
        <Button
          variant="ghost"
          onClick={handleDelete}
          disabled={del.isPending}
          className="text-rose-600 hover:bg-rose-50"
        >
          {del.isPending ? '删除中…' : '彻底删除'}
        </Button>
      </div>
    </section>
  )
}
