import type { ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  useArchiveCustomer,
  useCustomer,
  useSubApplicants,
  useUpdateCustomer,
} from '../../hooks/queries/useCustomers'
import { useCasesByCustomer } from '../../hooks/queries/useCases'
import { useEmployer } from '../../hooks/queries/useEmployers'
import { useReferrer } from '../../hooks/queries/useReferrers'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { StarToggle } from '../../components/ui/StarToggle'
import { BackLink } from '../../components/ui/BackLink'
import { LoadingBlock, ErrorBlock } from '../../components/ui/states'
import { StageBadge } from '../../components/cases/StageBadge'
import { DocumentsSection } from '../../components/documents/DocumentsSection'
import { FollowUpsSection } from '../../components/followups/FollowUpsSection'
import { TasksSection } from '../../components/tasks/TasksSection'
import { CustomerPaymentsSection } from '../../components/finance/CustomerPaymentsSection'
import { CUSTOMER_TIER_LABELS } from '../../types/domain'
import type { Customer } from '../../types/models'

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

/** 该客户名下的案件列表 + 新建入口 */
function CasesSection({ customerId }: { customerId: string }) {
  const cases = useCasesByCustomer(customerId)
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
            <li key={cs.id}>
              <Link
                to={`/cases/${cs.id}`}
                className="flex items-center justify-between px-3 py-2.5 text-sm hover:bg-slate-50"
              >
                <span className="font-medium text-slate-900">{cs.visa_subclass} 类签证</span>
                <span className="flex items-center gap-2">
                  <StageBadge stage={cs.current_stage} />
                  <span className="text-slate-300">›</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-400">暂无案件</p>
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
  const employer = useEmployer(query.data?.sponsor_employer_id)
  const referrer = useReferrer(query.data?.referrer_id)

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

  function handleArchive() {
    if (!window.confirm(`确定归档「${c.full_name}」吗？归档后默认不显示，可随时恢复。`)) return
    archive.mutate(c.id, { onSuccess: () => navigate('/customers') })
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
            {c.priority_tier && <Badge>{CUSTOMER_TIER_LABELS[c.priority_tier]}</Badge>}
            {c.is_archived && <Badge className="bg-gray-200 text-gray-600">已归档</Badge>}
          </div>
        </div>
        <Link to={`/customers/${c.id}/edit`}>
          <Button variant="secondary">编辑</Button>
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white px-4 py-2">
        <DetailRow label="电话">{c.phone}</DetailRow>
        <DetailRow label="微信">{c.wechat}</DetailRow>
        <DetailRow label="邮箱">{c.email}</DetailRow>
        <DetailRow label="护照号">{c.passport_no}</DetailRow>
        <DetailRow label="国籍">{c.nationality}</DetailRow>
        <DetailRow label="出生日期">{c.birth_date}</DetailRow>
        <DetailRow label="地址">{c.address}</DetailRow>
        <DetailRow label="担保雇主">
          {c.sponsor_employer_id ? (
            <Link to={`/employers/${c.sponsor_employer_id}/edit`} className="text-indigo-600 hover:underline">
              {employer.data?.name ?? '…'}
            </Link>
          ) : null}
        </DetailRow>
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

      <CustomerPaymentsSection customerId={c.id} />

      <DocumentsSection customerId={c.id} />

      <TasksSection customerId={c.id} />

      <FollowUpsSection customerId={c.id} />

      <FamilyGroup customer={c} />

      <div className="flex gap-3 pt-2">
        {!c.primary_applicant_id && (
          <Link to="/customers/new">
            <Button variant="secondary">+ 添加副申请人</Button>
          </Link>
        )}
        <Button variant="ghost" onClick={handleArchive} disabled={archive.isPending}>
          {c.is_archived ? '已归档' : '归档'}
        </Button>
      </div>
    </section>
  )
}
