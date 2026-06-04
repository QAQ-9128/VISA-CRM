import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useBackSource } from '../../../hooks/useBackSource'
import { Card } from '../../ui/Card'
import { StageBadge } from '../../cases/StageBadge'
import { StageProgressCard } from '../../cases/StageProgressCard'
import { CaseTodosCard } from '../../cases/CaseTodosCard'
import { useCaseApplicants } from '../../../hooks/queries/useCaseApplicants'
import { useCustomers } from '../../../hooks/queries/useCustomers'
import { useEmployer } from '../../../hooks/queries/useEmployers'
import { useReferrer } from '../../../hooks/queries/useReferrers'
import { useArchiveCase, useCaseStageHistory, useDeleteCase } from '../../../hooks/queries/useCases'
import { caseGroupCode, caseParticipantIds } from '../../../lib/caseGroups'
import { useLodgements } from '../../../hooks/queries/useLodgements'
import { getLodgementLodgedDate } from '../../../lib/lodgementStatus'
import { computeLodgementProgress } from '../../../lib/lodgementProgress'
import { formatElapsed } from '../../../lib/casesTable'
import { shouldShowTrtReminder, monthsSinceGrant } from '../../../lib/trt'
import { formatVisaType } from '../../../lib/visa'
import type { Case, Customer } from '../../../types/models'
import type { LodgementType } from '../../../types/domain'

/** 本案信息一行（2 列布局里的一格）。无值留「—」，不编造。标签加重、值加粗，强化可读性。 */
function InfoRow({ label, children, valueClass }: { label: string; children?: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-0">
      <span className="shrink-0 text-[12.5px] font-semibold text-muted">{label}</span>
      <span className={`min-w-0 truncate text-right text-[14px] font-semibold ${valueClass ?? 'text-ink'}`}>{children || '—'}</span>
    </div>
  )
}

/** 里程碑卡：提名/签证递交日期 + 已过 + 剩余天数（真实派生，无日期留空）。 */
function MilestoneCard({
  title,
  date,
  dhaDays,
}: {
  title: string
  date: string | null
  dhaDays: number | null
}) {
  const progress = computeLodgementProgress(date, dhaDays)
  return (
    <div className="rounded-[14px] border border-line-2 bg-surface-2/50 p-3">
      <div className="text-[12.5px] font-bold text-muted">{title}</div>
      <div className="mt-1 text-[16px] font-bold tabular-nums text-ink">{date ?? '—'}</div>
      {date && (
        <div className="mt-1 space-y-0.5 text-[12px] font-medium">
          <div className="text-faint">已过 {formatElapsed(date)}</div>
          {progress && (
            <div className={progress.isOverdue ? 'font-semibold text-rose-600' : 'text-emerald-600'}>
              {progress.isOverdue ? `已超期 ${Math.abs(progress.daysRemaining)} 天` : `剩 ${progress.daysRemaining} 天`}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * ② 相关案件卡：案件 tab（visa）+ 新建 → 切换驱动本案信息 / 当前状态 / 阶段流转 / 本案待办，
 * 并与概要带「当前案件·阶段」同步（同一 selectedCase）。
 * 一案一组：每个案件平铺显示全部参与客户（无归属/主导之分），全员共享同一进度，
 * 任何参与人的客户页都可推进阶段（StageControl 对参与案件同样可用）。
 */
export function RelatedCasesCard({
  customer,
  cases,
  selectedCase,
  onSelectCase,
}: {
  customer: Customer
  cases: Case[]
  selectedCase: Case | null
  onSelectCase: (caseId: string) => void
}) {
  const caseId = selectedCase?.id
  const backSource = useBackSource() // 打开案件页带来源 → 返回回到本客户档案
  // 担保职位/雇主改案件级（cases.sponsor_*）；旧案件为空则回退到客户字段，保住既有展示
  const sponsorPosition = selectedCase?.sponsor_position ?? customer.sponsor_position
  const sponsorEmployerId = selectedCase?.sponsor_employer_id ?? customer.sponsor_employer_id
  const employer = useEmployer(sponsorEmployerId)
  const referrer = useReferrer(customer.referrer_id)
  // 参与客户（owner + case_applicants，平铺无角色/无归属标注）
  const allCustomers = useCustomers({})
  const applicants = useCaseApplicants(caseId)
  const customerNameById = useMemo(
    () => Object.fromEntries((allCustomers.data ?? []).map((cu) => [cu.id, cu.full_name])) as Record<string, string>,
    [allCustomers.data],
  )
  const participantNames = useMemo(() => {
    if (!selectedCase) return []
    const ids = [selectedCase.customer_id, ...(applicants.data ?? []).map((a) => a.customer_id)]
    const seen = new Set<string>()
    const names: string[] = []
    for (const cid of ids) {
      if (seen.has(cid)) continue
      seen.add(cid)
      const n = cid === customer.id ? customer.full_name : customerNameById[cid]
      if (n) names.push(n)
    }
    return names
  }, [selectedCase, applicants.data, customerNameById, customer.id, customer.full_name])
  const history = useCaseStageHistory(caseId)
  const lodgements = useLodgements(caseId)
  // 案件级危险操作（与案件页同款确认文案）；归档/删除后列表自动刷新、选中回落到首个案件
  const archiveM = useArchiveCase()
  const delM = useDeleteCase()
  // 一案一组：本案组码 = 参与人集合派生（与案件页/案件表同码）
  const groupCode = selectedCase ? caseGroupCode(caseParticipantIds(selectedCase, applicants.data ?? []), selectedCase.id) : ''

  function handleArchiveCase() {
    if (!selectedCase) return
    if (!window.confirm('确定归档该案件吗？归档后默认不显示，可随时恢复。')) return
    archiveM.mutate(selectedCase.id)
  }
  function handleDeleteCase() {
    if (!selectedCase) return
    if (!window.confirm('彻底删除该案件？\n\n将连同其递交记录、阶段历史、账目一并【永久删除，不可恢复】！\n如只想暂时隐藏，请用「归档案件」。')) return
    delM.mutate(selectedCase.id)
  }

  const hist = useMemo(() => history.data ?? [], [history.data])
  const nomDate = getLodgementLodgedDate(hist, 'nomination')
  const visaDate = getLodgementLodgedDate(hist, 'visa')
  const dhaOf = (t: LodgementType) => (lodgements.data ?? []).find((l) => l.type === t)?.dha_processing_days ?? null
  const updatedAt = useMemo(() => {
    let best: string | null = null
    for (const h of hist) {
      const d = (h.effective_at ?? h.changed_at)?.slice(0, 10)
      if (d && (!best || d > best)) best = d
    }
    return best
  }, [hist])

  const showTrt = selectedCase ? shouldShowTrtReminder(selectedCase, cases, hist) : false
  const trtMonths = showTrt ? monthsSinceGrant(hist) ?? 0 : 0

  return (
    <Card className="h-full">
      {/* 案件 tab 条 + 新建 */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="font-serif text-[18px] font-bold tracking-[-0.01em] text-ink">相关案件</h2>
        <Link
          to={`/cases/new?customer=${customer.id}`}
          className="grid size-8 place-items-center rounded-full bg-surface-2 text-lg text-brand hover:bg-brand-50"
          title="新建案件"
          aria-label="新建案件"
        >
          +
        </Link>
      </div>

      {cases.length === 0 ? (
        <p className="rounded-[12px] border border-dashed border-line-2 px-3 py-6 text-center text-sm text-faint">
          暂无案件 · 点右上「+」新建案件
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 border-b border-line pb-3">
            {cases.map((cs) => {
              const activeTab = cs.id === selectedCase?.id
              return (
                <button
                  key={cs.id}
                  type="button"
                  onClick={() => onSelectCase(cs.id)}
                  className={`rounded-full px-3.5 py-1.5 text-[13.5px] font-bold transition-colors ${
                    activeTab ? 'bg-brand-700 text-white shadow-brand' : 'bg-surface-2 text-body hover:bg-brand-50'
                  }`}
                >
                  {formatVisaType(cs.visa_subclass, cs.visa_stream)}
                </button>
              )
            })}
          </div>

          {selectedCase && (
            <div className="space-y-5 pt-4">
              {/* 本案操作：编辑案件 + ⋯ 菜单（归档/删除收纳于此，与页面底部的客户级操作彻底分开） */}
              <div className="-mb-2 flex items-center justify-end gap-2.5">
                <Link
                  to={`/cases/${selectedCase.id}/edit`}
                  state={backSource}
                  className="text-[12.5px] font-semibold text-brand hover:text-brand-600 hover:underline"
                  title="编辑签证类别/担保/参与人等"
                >
                  编辑案件 ›
                </Link>
                <details className="relative">
                  <summary
                    aria-label="本案更多操作"
                    title="本案更多操作（归档 / 删除）"
                    className="grid size-7 cursor-pointer list-none place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink [&::-webkit-details-marker]:hidden"
                  >
                    ⋯
                  </summary>
                  <div className="absolute right-0 z-10 mt-1 w-44 overflow-hidden rounded-[12px] border border-line bg-white py-1 shadow-soft">
                    <button
                      type="button"
                      disabled={archiveM.isPending || selectedCase.is_archived}
                      onClick={(e) => {
                        e.currentTarget.closest('details')?.removeAttribute('open')
                        handleArchiveCase()
                      }}
                      className="block w-full px-3.5 py-2 text-left text-[13px] text-body hover:bg-surface-2 disabled:opacity-50"
                    >
                      {selectedCase.is_archived ? '已归档' : '归档本案'}
                      <span className="block text-[11px] text-faint">隐藏不删数据，可恢复</span>
                    </button>
                    <button
                      type="button"
                      disabled={delM.isPending}
                      onClick={(e) => {
                        e.currentTarget.closest('details')?.removeAttribute('open')
                        handleDeleteCase()
                      }}
                      className="block w-full px-3.5 py-2 text-left text-[13px] text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                    >
                      {delM.isPending ? '删除中…' : '彻底删除本案'}
                      <span className="block text-[11px] text-rose-300">连同账目/历史，不可恢复</span>
                    </button>
                  </div>
                </details>
              </div>

              {/* 本案信息（2 列） */}
              <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                <InfoRow label="签证子类别">{selectedCase.visa_stream || selectedCase.visa_subclass}</InfoRow>
                <InfoRow label="担保职位">{sponsorPosition}</InfoRow>
                <InfoRow label="担保雇主">
                  {sponsorEmployerId ? employer.data?.name ?? '…' : null}
                </InfoRow>
                <InfoRow label="介绍人" valueClass="text-rose-600">
                  {customer.referrer_id ? referrer.data?.name ?? '…' : null}
                </InfoRow>
                {/* 一案一组：平铺显示本案全部参与客户（无归属/主导之分），全员进度一致 */}
                <InfoRow label="参与客户">{participantNames.join('、')}</InfoRow>
                <InfoRow label="Group 组码">
                  <span className="rounded-full bg-[var(--color-lime-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-lime-ink)]">
                    {groupCode}
                  </span>
                </InfoRow>
              </div>

              {/* 当前状态：更新至 chip + 日期 + 两里程碑卡 */}
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold text-muted">更新至</span>
                  <StageBadge stage={selectedCase.current_stage} />
                  <span className="text-[12.5px] font-medium tabular-nums text-faint">{updatedAt ?? '—'}</span>
                  {participantNames.length > 1 && (
                    <span className="text-[12.5px] font-medium text-faint">· 全员进度一致</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <MilestoneCard title="提名递交" date={nomDate} dhaDays={dhaOf('nomination')} />
                  <MilestoneCard title="签证递交" date={visaDate} dhaDays={dhaOf('visa')} />
                </div>
              </div>

              {/* 阶段进展（与案件详情页同一组件，UI 完全一致）：真实阶段链 + 推进阶段 + 阶段流转记录 */}
              <StageProgressCard caseRow={selectedCase} key={selectedCase.id} />

              {/* 本案待办（与案件详情页同一组件，功能完全一致：+添加 / 完成 / 删除 / 近期跟进） */}
              <CaseTodosCard caseRow={selectedCase} trt={{ show: showTrt, months: trtMonths }} key={`todos-${selectedCase.id}`} />
            </div>
          )}
        </>
      )}
    </Card>
  )
}
