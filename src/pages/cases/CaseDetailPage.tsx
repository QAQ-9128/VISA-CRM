import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useArchiveCase, useCase, useCaseStageHistory, useDeleteCase } from '../../hooks/queries/useCases'
import { useCasesByCustomer } from '../../hooks/queries/useCases'
import { useCustomer, useCustomers } from '../../hooks/queries/useCustomers'
import { useCaseApplicants } from '../../hooks/queries/useCaseApplicants'
import { usePaymentPlan, usePaymentsByCase, useAllPlanItems, useInstallments } from '../../hooks/queries/usePayments'
import { useRecordsByCase } from '../../hooks/queries/useRecords'
import { useDocumentsByCase } from '../../hooks/queries/useDocuments'
import { shouldShowTrtReminder, monthsSinceGrant } from '../../lib/trt'
import { resolveBackLink } from '../../lib/backLink'
import { useBackSource } from '../../hooks/useBackSource'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { BackLink } from '../../components/ui/BackLink'
import { LoadingBlock, ErrorBlock } from '../../components/ui/states'
import { ClipboardIcon, DocIcon, ShieldIcon } from '../../components/ui/icons'
import { formatVisaType } from '../../lib/visa'
import { relationshipOf } from '../../lib/caseRelationship'
import { getLodgementLodgedDate } from '../../lib/lodgementStatus'
import { getCaseTotals } from '../../lib/planItems'
import { sortRecords } from '../../lib/records'
import { CASE_STAGE_LABELS } from '../../types/domain'
import { StageBadge } from '../../components/cases/StageBadge'
import { StageControl } from '../../components/cases/StageControl'
import { StageStepper } from '../../components/cases/StageStepper'
import { StageTimeline } from '../../components/cases/StageTimeline'
import { CaseOverviewSummary } from '../../components/cases/CaseOverviewSummary'
import { LodgementTab } from '../../components/cases/LodgementTab'
import { PaymentTab } from '../../components/payments/PaymentTab'
import { DocumentsSection } from '../../components/documents/DocumentsSection'
import { RecordsSection } from '../../components/records/RecordsSection'

type CaseTab = '概览' | '递交' | '付款' | '文件' | '记录'
const CASE_TABS: CaseTab[] = ['概览', '递交', '付款', '文件', '记录']

/** 概览汇总小卡：彩色圆标 + 标签 + 值。 */
function SumCard({ icon, bg, label, value }: { icon: ReactNode; bg: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3.5 rounded-card bg-white p-[18px] shadow-soft">
      <span className="grid size-12 shrink-0 place-items-center rounded-full text-white" style={{ background: bg }}>
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[13px] text-muted">{label}</div>
        <div className="mt-0.5 truncate text-[17px] font-bold text-ink">{value}</div>
      </div>
    </div>
  )
}


export function CaseDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const source = useBackSource()
  const caseQuery = useCase(id)
  const c = caseQuery.data
  const customer = useCustomer(c?.customer_id)
  const customerCases = useCasesByCustomer(c?.customer_id)
  // 依附的主案件（软关联，纯展示）：getCase 不过滤 is_archived → 主案件即便已归档仍能显示
  const parentCase = useCase(c?.parent_case_id ?? undefined)
  const parentCustomer = useCustomer(parentCase.data?.customer_id)
  const stageHistory = useCaseStageHistory(c?.id)
  const archive = useArchiveCase()
  const del = useDeleteCase()
  // 概览摘要数据（递交日期由 stage_history 派生；付款用款项明细口径，同财务页）
  const plan = usePaymentPlan(c?.id)
  const casePayments = usePaymentsByCase(c?.id)
  const allItems = useAllPlanItems()
  const installments = useInstallments(plan.data?.id)
  const caseRecords = useRecordsByCase(c?.id)
  const caseDocs = useDocumentsByCase(c?.id)
  // 副申请人（case_applicants）→ 解析为客户，只读展示（主申 = c.customer_id 已在「客户」行）
  const caseApplicants = useCaseApplicants(c?.id)
  const allCustomers = useCustomers({})
  const [tab, setTab] = useState<CaseTab>('概览')

  const coApplicants = useMemo(() => {
    const byId = new Map((allCustomers.data ?? []).map((cu) => [cu.id, cu]))
    return (caseApplicants.data ?? [])
      .map((a) => byId.get(a.customer_id))
      .filter((cu): cu is NonNullable<typeof cu> => !!cu)
  }, [caseApplicants.data, allCustomers.data])

  const history = useMemo(() => stageHistory.data ?? [], [stageHistory.data])
  const nomDate = useMemo(() => getLodgementLodgedDate(history, 'nomination'), [history])
  const visaDate = useMemo(() => getLodgementLodgedDate(history, 'visa'), [history])
  const payTotals = useMemo(() => {
    const items = plan.data ? (allItems.data ?? []).filter((i) => i.plan_id === plan.data!.id) : []
    return getCaseTotals(items, casePayments.data ?? [])
  }, [plan.data, allItems.data, casePayments.data])
  // 分期进度（计划级 installments）
  const instTotal = installments.data?.length ?? 0
  const instPaid = installments.data?.filter((i) => i.is_paid).length ?? 0
  const instPct = instTotal > 0 ? Math.round((instPaid / instTotal) * 100) : 0
  // 最近记录 / 未完成待办
  const sortedRecords = useMemo(() => sortRecords(caseRecords.data ?? []), [caseRecords.data])
  const recentRecords = sortedRecords.slice(0, 3)
  const openTasks = useMemo(() => sortedRecords.filter((r) => r.type === 'task' && !r.is_done).slice(0, 3), [sortedRecords])
  // 文件（未归档）
  const docs = useMemo(
    () => (caseDocs.data ?? []).filter((d) => !d.is_archived).slice().sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [caseDocs.data],
  )
  const recentDocs = docs.slice(0, 3)

  if (caseQuery.isPending) return <LoadingBlock />
  if (caseQuery.isError) return <ErrorBlock error={caseQuery.error} />
  if (!c) {
    return (
      <div className="mx-auto max-w-2xl text-center text-muted">
        案件不存在或已被删除。
        <div className="mt-4">
          <Link to="/customers" className="font-semibold text-brand hover:underline">
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

  function handleDelete() {
    if (
      !window.confirm(
        '彻底删除该案件？\n\n将连同其递交记录、阶段历史、账单/分期/收付款一并【永久删除，不可恢复】！\n如只想暂时隐藏，请用「归档案件」。',
      )
    )
      return
    del.mutate(c!.id, { onSuccess: () => navigate(`/customers/${c!.customer_id}`) })
  }

  const trtHistory = stageHistory.data ?? []
  const showTrt = shouldShowTrtReminder(c, customerCases.data ?? [c], trtHistory)
  const trtMonths = monthsSinceGrant(trtHistory)

  return (
    <section className="mx-auto max-w-[1040px] space-y-5">
      {(() => {
        const back = resolveBackLink(location.state, { to: `/customers/${c.customer_id}`, label: '返回客户档案' })
        return <BackLink to={back.to} label={back.label} />
      })()}

      {showTrt && (
        <div className="flex items-start gap-2.5 rounded-[16px] bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 ring-1 ring-amber-200">
          <span aria-hidden>⚠️</span>
          <span>签证已下签 {trtMonths} 个月，可以开始办 186 TRT 永居</span>
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">
              {formatVisaType(c.visa_subclass, c.visa_stream)} 签证
            </h1>
            {c.is_archived && <Badge className="bg-slate-200 text-slate-600">已归档</Badge>}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted">
            <span>
              客户：
              <Link to={`/customers/${c.customer_id}`} state={source} className="font-semibold text-brand hover:underline">
                {customer.data?.full_name ?? '…'}
              </Link>
              {c.destination_country ? ` · ${c.destination_country}` : ''}
            </span>
            <span className="inline-flex items-center gap-1.5">
              当前阶段 <StageBadge stage={c.current_stage} />
            </span>
            {coApplicants.length > 0 && (
              <span className="inline-flex flex-wrap items-center gap-1.5">
                副申：
                {coApplicants.map((cu, i) => (
                  <span key={cu.id}>
                    <Link to={`/customers/${cu.id}`} state={source} className="font-semibold text-brand hover:underline">
                      {cu.full_name}
                    </Link>
                    {i < coApplicants.length - 1 ? '、' : ''}
                  </span>
                ))}
              </span>
            )}
          </div>
          {c.parent_case_id && parentCase.data && (() => {
            const synced = relationshipOf(c) === 'synced'
            const parentLabel = `${parentCustomer.data?.full_name ?? '…'} · ${formatVisaType(parentCase.data.visa_subclass, parentCase.data.visa_stream)}`
            return (
              <Link
                to={`/cases/${parentCase.data.id}`}
                state={source}
                className={`mt-2 inline-flex flex-wrap items-center gap-1.5 rounded-[12px] border px-2.5 py-1 text-sm transition-colors ${
                  synced
                    ? 'border-brand-100 bg-brand-50 text-brand hover:border-brand'
                    : 'border-line-2 bg-surface-2 text-muted hover:border-brand hover:text-brand'
                }`}
              >
                <span aria-hidden>{synced ? '🔗' : '📎'}</span>
                <span>
                  {synced ? '进度同步自主案件：' : '关联主案件：'}
                  {parentLabel}
                  <span className="text-xs opacity-70">{synced ? '（stage 自动跟随）' : '（进度独立）'}</span>
                </span>
                <StageBadge stage={parentCase.data.current_stage} />
              </Link>
            )
          })()}
        </div>
        <div className="flex shrink-0 gap-2">
          <Link to={`/cases/${c.id}/edit`}>
            <Button variant="secondary">编辑</Button>
          </Link>
        </div>
      </div>

      {/* 标签页：概览 / 递交 / 付款 / 文件 / 记录 */}
      <div className="flex gap-1 overflow-x-auto border-b border-line-2">
        {CASE_TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === t ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-body'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === '概览' && (
        <div className="space-y-5">
          {/* 顶部 3 信息卡（递交日期已在此，正文不再重复） */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SumCard icon={<ClipboardIcon className="size-6" />} bg="#3b6bff" label="当前阶段" value={CASE_STAGE_LABELS[c.current_stage]} />
            <SumCard icon={<ShieldIcon className="size-6" />} bg="#8b5cf6" label="提名递交" value={nomDate ?? '暂无'} />
            <SumCard icon={<DocIcon className="size-6" />} bg="#10b981" label="签证递交" value={visaDate ?? '暂无'} />
          </div>

          {/* 阶段管理（全部 11 个阶段）+ 阶段时间线 */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <StageControl
              caseId={c.id}
              currentStage={c.current_stage}
              disabled={relationshipOf(c) === 'synced'}
              disabledHint="本案件进度同步自主案件，stage 自动跟随。如需独立编辑请改回「进度独立」。"
            />
            <div className="space-y-4 rounded-card bg-white p-[22px] shadow-soft">
              <h2 className="text-base font-bold text-ink">阶段时间线</h2>
              {/* 全部真实阶段步进（已过实心 / 当前高亮 / 未到空心；拒签·撤签标红） */}
              <StageStepper current={c.current_stage} />
              <div className="border-t border-line pt-4">
                <StageTimeline caseId={c.id} />
              </div>
            </div>
          </div>

          {/* 摘要 dashboard：付款 / 下一步 / 最近记录 / 文件（参考客户详情概览的分栏卡片） */}
          <CaseOverviewSummary
            syncTracking={c.sync_tracking}
            payTotals={payTotals}
            instTotal={instTotal}
            instPaid={instPaid}
            instPct={instPct}
            records={recentRecords}
            openTasks={openTasks}
            docs={recentDocs}
            docCount={docs.length}
            currentStage={c.current_stage}
            showTrt={showTrt}
            trtMonths={trtMonths ?? 0}
            onTab={(t) => setTab(t)}
          />
        </div>
      )}

      {tab === '递交' && <LodgementTab caseId={c.id} currentStage={c.current_stage} />}

      {tab === '付款' && (
        <PaymentTab
          caseId={c.id}
          currency={c.currency}
          syncTracking={c.sync_tracking}
          customerId={c.customer_id}
          primaryCustomerId={c.customer_id}
        />
      )}

      {tab === '文件' && <DocumentsSection customerId={c.customer_id} caseId={c.id} />}

      {tab === '记录' && <RecordsSection customerId={c.customer_id} caseId={c.id} />}

      <div className="flex gap-3 pt-2">
        <Button variant="ghost" onClick={handleArchive} disabled={archive.isPending}>
          {c.is_archived ? '已归档' : '归档案件'}
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
