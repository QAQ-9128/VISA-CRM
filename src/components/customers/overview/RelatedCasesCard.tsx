import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useBackSource } from '../../../hooks/useBackSource'
import { Card } from '../../ui/Card'
import { StageBadge } from '../../cases/StageBadge'
import { StageControl } from '../../cases/StageControl'
import { StageTimeline } from '../../cases/StageTimeline'
import { useCaseApplicants } from '../../../hooks/queries/useCaseApplicants'
import { useCustomers } from '../../../hooks/queries/useCustomers'
import { useEmployer } from '../../../hooks/queries/useEmployers'
import { useReferrer } from '../../../hooks/queries/useReferrers'
import { useCaseStageHistory } from '../../../hooks/queries/useCases'
import { useLodgements } from '../../../hooks/queries/useLodgements'
import { useRecordsByCase } from '../../../hooks/queries/useRecords'
import { useDocumentsByCase } from '../../../hooks/queries/useDocuments'
import { getLodgementLodgedDate } from '../../../lib/lodgementStatus'
import { computeLodgementProgress } from '../../../lib/lodgementProgress'
import { formatElapsed } from '../../../lib/casesTable'
import { shouldShowTrtReminder, monthsSinceGrant } from '../../../lib/trt'
import { selectCaseTodos } from '../../../lib/caseTodos'
import { formatVisaType } from '../../../lib/visa'
import type { Case, Customer } from '../../../types/models'
import type { LodgementType } from '../../../types/domain'

/** 本案信息一行（2 列布局里的一格）。无值留「—」，不编造。 */
function InfoRow({ label, children, valueClass }: { label: string; children?: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-0">
      <span className="shrink-0 text-[13px] text-muted">{label}</span>
      <span className={`min-w-0 truncate text-right text-[13px] font-medium ${valueClass ?? 'text-ink'}`}>{children || '—'}</span>
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
      <div className="text-[12px] font-semibold text-muted">{title}</div>
      <div className="mt-1 text-[15px] font-bold tabular-nums text-ink">{date ?? '—'}</div>
      {date && (
        <div className="mt-1 space-y-0.5 text-[11.5px]">
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

const TODO_TONE: Record<string, string> = {
  amber: 'text-amber-700',
  rose: 'text-rose-600',
  default: 'text-body',
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
  const records = useRecordsByCase(caseId)
  const docs = useDocumentsByCase(caseId)

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
  const todos = useMemo(
    () => selectCaseTodos({ records: records.data ?? [], docs: docs.data ?? [], trt: { show: showTrt, months: trtMonths } }),
    [records.data, docs.data, showTrt, trtMonths],
  )

  return (
    <Card className="h-full">
      {/* 案件 tab 条 + 新建 */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="font-serif text-[17px] font-bold text-ink">相关案件</h2>
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
                  className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
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
              {/* 打开案件页：客户详情 → 案件详情 的直达入口（阶段链/费用/待办的完整单页） */}
              <div className="-mb-2 flex justify-end">
                <Link
                  to={`/cases/${selectedCase.id}`}
                  state={backSource}
                  className="text-[12.5px] font-semibold text-brand hover:text-brand-600 hover:underline"
                >
                  打开案件页 ›
                </Link>
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
              </div>

              {/* 当前状态：更新至 chip + 日期 + 两里程碑卡 */}
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-[13px] text-muted">更新至</span>
                  <StageBadge stage={selectedCase.current_stage} />
                  <span className="text-[12px] text-faint">{updatedAt ?? '—'}</span>
                  {participantNames.length > 1 && (
                    <span className="text-[12px] text-faint">· 全员进度一致</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <MilestoneCard title="提名递交" date={nomDate} dhaDays={dhaOf('nomination')} />
                  <MilestoneCard title="签证递交" date={visaDate} dhaDays={dhaOf('visa')} />
                </div>
              </div>

              {/* 阶段流转 · Records（复用） */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* 客户页无「同步主案件」锁定：只要参与本案，进度都可在此编辑（一份进度全员共享） */}
                <StageControl caseId={selectedCase.id} currentStage={selectedCase.current_stage} />
                <div className="space-y-3 rounded-card bg-white p-[18px] shadow-soft">
                  <h3 className="font-serif text-[15px] font-bold text-ink">阶段流转 · Records</h3>
                  <StageTimeline caseId={selectedCase.id} />
                </div>
              </div>

              {/* 本案待办清单（只本案派生） */}
              <div className="border-t border-line pt-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-serif text-[15px] font-bold text-ink">本案待办清单</h3>
                  <span className="text-[12px] text-faint">共 {todos.length} 项</span>
                </div>
                {todos.length === 0 ? (
                  <p className="text-sm text-faint">本案暂无待办</p>
                ) : (
                  <ul className="space-y-2">
                    {todos.map((t) => (
                      <li key={t.id} className="flex items-center gap-2 text-sm">
                        <span aria-hidden>{t.kind === 'trt' ? '⚠️' : t.kind === 'expiry' ? '📎' : '☑️'}</span>
                        <span className={`min-w-0 flex-1 truncate ${TODO_TONE[t.tone]}`}>
                          {t.text}
                          {t.sub && <span className="text-[11.5px] text-faint"> · {t.sub}</span>}
                        </span>
                        {t.badge && (
                          <span className={`shrink-0 text-[12px] font-semibold ${t.tone === 'rose' ? 'text-rose-600' : 'text-faint'}`}>
                            {t.badge}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
