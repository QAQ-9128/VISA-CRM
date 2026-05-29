import { Link, useNavigate, useParams } from 'react-router-dom'
import { useArchiveCase, useCase } from '../../hooks/queries/useCases'
import { useCustomer } from '../../hooks/queries/useCustomers'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { BackLink } from '../../components/ui/BackLink'
import { LoadingBlock, ErrorBlock } from '../../components/ui/states'
import { formatVisaType } from '../../lib/visa'
import { StageControl } from '../../components/cases/StageControl'
import { StageTimeline } from '../../components/cases/StageTimeline'
import { LodgementSection } from '../../components/cases/LodgementSection'
import { PaymentsSection } from '../../components/payments/PaymentsSection'
import { DocumentsSection } from '../../components/documents/DocumentsSection'
import { FollowUpsSection } from '../../components/followups/FollowUpsSection'
import { TasksSection } from '../../components/tasks/TasksSection'

export function CaseDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const caseQuery = useCase(id)
  const c = caseQuery.data
  const customer = useCustomer(c?.customer_id)
  const archive = useArchiveCase()

  if (caseQuery.isPending) return <LoadingBlock />
  if (caseQuery.isError) return <ErrorBlock error={caseQuery.error} />
  if (!c) {
    return (
      <div className="mx-auto max-w-2xl text-center text-slate-500">
        案件不存在或已被删除。
        <div className="mt-4">
          <Link to="/customers" className="text-indigo-600 hover:underline">
            返回客户列表
          </Link>
        </div>
      </div>
    )
  }

  function handleArchive() {
    if (!window.confirm('确定归档该案件吗？归档后默认不显示，可随时恢复。')) return
    archive.mutate(c!.id, { onSuccess: () => navigate(`/customers/${c!.customer_id}`) })
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <BackLink to="/cases" label="全部案件" />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">
              {formatVisaType(c.visa_subclass, c.visa_stream)} 签证
            </h1>
            {c.is_archived && <Badge className="bg-gray-200 text-gray-600">已归档</Badge>}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            客户：
            <Link to={`/customers/${c.customer_id}`} className="text-indigo-600 hover:underline">
              {customer.data?.full_name ?? '…'}
            </Link>
            {c.destination_country ? ` · ${c.destination_country}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link to={`/cases/${c.id}/edit`}>
            <Button variant="secondary">编辑</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <StageControl caseId={c.id} currentStage={c.current_stage} />
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-base font-semibold text-slate-900">阶段时间线</h2>
          <StageTimeline caseId={c.id} />
        </div>
      </div>

      <LodgementSection caseId={c.id} />

      <PaymentsSection caseId={c.id} currency={c.currency} syncTracking={c.sync_tracking} customerId={c.customer_id} />

      <DocumentsSection customerId={c.customer_id} caseId={c.id} />

      <TasksSection customerId={c.customer_id} caseId={c.id} />

      <FollowUpsSection customerId={c.customer_id} caseId={c.id} />

      <div className="pt-2">
        <Button variant="ghost" onClick={handleArchive} disabled={archive.isPending}>
          {c.is_archived ? '已归档' : '归档案件'}
        </Button>
      </div>
    </section>
  )
}
