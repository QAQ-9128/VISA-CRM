import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useBackSource } from '../../../hooks/useBackSource'
import { Card } from '../../ui/Card'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { StageBadge } from '../../cases/StageBadge'
import { StageProgressCard } from '../../cases/StageProgressCard'
import { CaseTodosCard } from '../../cases/CaseTodosCard'
import {
  useAddCaseApplicant,
  useCaseApplicants,
  useRemoveSelfFromCase,
} from '../../../hooks/queries/useCaseApplicants'
import { useCustomers } from '../../../hooks/queries/useCustomers'
import { useEmployer } from '../../../hooks/queries/useEmployers'
import { useReferrer } from '../../../hooks/queries/useReferrers'
import { useArchiveCase, useCaseStageHistory, useDeleteCase } from '../../../hooks/queries/useCases'
import { caseGroupCode, caseParticipantIds } from '../../../lib/caseGroups'
import { useLodgements } from '../../../hooks/queries/useLodgements'
import { getLodgementStatus } from '../../../lib/lodgementStatus'
import { flowProcessing } from '../../../lib/casesTable'
import { useDetailsAutoClose } from '../../../hooks/useDetailsAutoClose'
import { MilestoneCard } from './MilestoneCard'
import { TrtReminderCard } from '../../cases/TrtReminderCard'
import { CohabReminderCard } from '../../cases/CohabReminderCard'
import { shouldShowTrtReminder, monthsSinceGrant } from '../../../lib/trt'
import { shouldShowCohabReminder, monthsSinceCohabAnchor } from '../../../lib/cohab'
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

/**
 * 参与人管理（2026-06-05 终版）：参与人完全平级（无案件客户特殊标注）——
 * 名字全部挂链接跳各自客户页；**✕ 只出现在本页客户自己的 chip 上**（任何人都能且只能移出自己；
 * 案件客户移出自己 = 本案过户给其余参与人；唯一参与人不能移出，提示改用归档/删除本案）。
 * 已归档参与人不显示（所有地方不显示已归档的东西）。
 */
function ParticipantManager({
  caseId,
  participants,
  pageCustomerId,
  pageCustomerName,
  candidates,
}: {
  caseId: string
  /** 在册参与人（案件客户在首位，仅作内部顺序，无 UI 区分） */
  participants: { id: string; name: string }[]
  /** 本页客户 id/名：只有 TA 自己的 chip 显示 ✕ */
  pageCustomerId: string
  pageCustomerName: string
  candidates: Customer[]
}) {
  const source = useBackSource()
  const add = useAddCaseApplicant()
  const remove = useRemoveSelfFromCase()
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [confirmingLeave, setConfirmingLeave] = useState(false)

  const q = query.trim().toLowerCase()
  const list = candidates.filter((c) => !q || c.full_name.toLowerCase().includes(q)).slice(0, 8)
  // 唯一参与人不能移出（案件不能没有人）→ 不显示 ✕
  const canLeave = participants.length > 1

  return (
    <div className="border-b border-line py-2.5 last:border-0 sm:col-span-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 text-[12.5px] font-semibold text-muted">参与客户</span>
        {participants.map((p) => {
          const isSelf = p.id === pageCustomerId
          return (
            <span
              key={p.id}
              className={`inline-flex items-center gap-1 rounded-full bg-surface-2 py-0.5 pl-2.5 text-[12px] font-semibold text-ink ${
                isSelf && canLeave ? 'pr-1' : 'pr-2.5'
              }`}
            >
              <Link to={`/customers/${p.id}`} state={source} className="hover:text-brand hover:underline">
                {p.name}
              </Link>
              {/* 在谁的客户页只能移谁：✕ 仅本页客户自己的 chip */}
              {isSelf && canLeave && (
                <button
                  type="button"
                  aria-label={`移出 ${p.name}`}
                  onClick={() => setConfirmingLeave(true)}
                  disabled={remove.isPending}
                  className="grid size-5 place-items-center rounded-full text-[11px] text-faint hover:bg-rose-50 hover:text-rose-600"
                >
                  ✕
                </button>
              )}
            </span>
          )
        })}
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="text-[12.5px] font-semibold text-brand hover:text-brand-600"
        >
          {adding ? '收起' : '+ 添加参与人'}
        </button>
      </div>

      {adding && (
        <div className="mt-2 overflow-hidden rounded-xl border border-brand-100 bg-white">
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索客户姓名…"
            className="w-full border-b border-line px-3 py-2 text-sm text-ink outline-none placeholder:text-faint"
          />
          <ul className="max-h-44 overflow-auto">
            {list.length === 0 ? (
              <li className="px-3 py-2.5 text-sm text-faint">没有可添加的客户</li>
            ) : (
              list.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={add.isPending}
                    onClick={() => add.mutate({ caseId, customerId: c.id })}
                    className="flex min-h-10 w-full items-center px-3 py-1.5 text-left text-sm text-ink hover:bg-brand-50 disabled:opacity-50"
                  >
                    {c.full_name}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      {confirmingLeave && (
        <ConfirmDialog
          open
          title={`将「${pageCustomerName}」移出本案？`}
          description={
            <>
              移出后本案由其余参与人继续，<b>案件与账目数据原样保留</b>；
              TA 的客户档案不受影响，随时可被重新添加回来。
            </>
          }
          confirmLabel="移出"
          pendingLabel="移出中…"
          pending={remove.isPending}
          onConfirm={() => {
            setConfirmingLeave(false)
            remove.mutate({ caseId, customerId: pageCustomerId })
          }}
          onClose={() => setConfirmingLeave(false)}
        />
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
  // 0031 起彻底删除全员开放（两位用户均 staff，2026-06 拍板）；防误删靠红色确认弹窗
  // 一案一组：本案组码 = 参与人集合派生（与案件页/案件表同码）
  const groupCode = selectedCase ? caseGroupCode(caseParticipantIds(selectedCase, applicants.data ?? []), selectedCase.id) : ''

  const [confirmingDeleteCase, setConfirmingDeleteCase] = useState(false)
  const [confirmingArchiveCase, setConfirmingArchiveCase] = useState(false)

  // 参与人管理数据：名字映射补上本页客户自己（allCustomers 查询与本页客户详情可能有时差）
  const participantNameById = useMemo(
    () => ({ ...customerNameById, [customer.id]: customer.full_name }),
    [customerNameById, customer.id, customer.full_name],
  )
  const memberIds = useMemo(() => {
    if (!selectedCase) return []
    return [...new Set((applicants.data ?? []).map((a) => a.customer_id))].filter(
      (cid) => cid !== selectedCase.customer_id,
    )
  }, [selectedCase, applicants.data])
  // 在册参与人 chips（案件客户在首位但无 UI 区分；已归档的解析不到名字 → 不显示）
  const managerParticipants = useMemo(() => {
    if (!selectedCase) return []
    return [selectedCase.customer_id, ...memberIds]
      .map((cid) => ({ id: cid, name: participantNameById[cid] ?? '' }))
      .filter((p) => p.name !== '')
  }, [selectedCase, memberIds, participantNameById])
  const addCandidates = useMemo(() => {
    if (!selectedCase) return []
    const taken = new Set([selectedCase.customer_id, ...memberIds])
    return (allCustomers.data ?? [])
      .filter((cu) => !cu.is_archived && !taken.has(cu.id))
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
  }, [selectedCase, memberIds, allCustomers.data])

  const hist = useMemo(() => history.data ?? [], [history.data])
  // 本案 ⋯ 菜单：点外部空白/Esc 自动收起（与客户列表 ⋯ 菜单同一行为）
  const caseMenuRef = useDetailsAutoClose()
  // 提名/签证审理时长 + 状态：与案件进度表同一来源口径（flowProcessing / getLodgementStatus）
  const stage = selectedCase?.current_stage ?? 'todo'
  const nomP = flowProcessing('nomination', stage, hist)
  const visaP = flowProcessing('visa', stage, hist)
  const nomStatus = nomP.lodged || nomP.approved ? getLodgementStatus(stage, 'nomination', hist) : null
  const visaStatus = visaP.lodged || visaP.approved ? getLodgementStatus(stage, 'visa', hist) : null
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
  // 186/配偶签「3 个月更新同居材料」循环提醒（lib/cohab 派生：已勾选 + 满 3 个月 + 未到终态）
  const showCohab = selectedCase ? shouldShowCohabReminder(selectedCase, hist) : false
  const cohabMonths = showCohab && selectedCase ? monthsSinceCohabAnchor(selectedCase, hist) : 0

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
              {/* 482→186 TRT 永居提醒（清新绿）：下签满 22 个月 + 客户名下无 186 TRT 案 + 未手动停止时显示。
                  「新建 186 TRT 案件」预填 186 ENS·TRT·该客户；「不再提醒」置 dismissed。客户详情=案件中心单页，
                  此卡同时覆盖「案件页 / 客户页」两处语义面（另一处是概览的临近到期条）。 */}
              {showTrt && (
                <TrtReminderCard customerId={selectedCase.customer_id} caseId={selectedCase.id} months={trtMonths} />
              )}

              {/* 186/配偶签：每满 3 个月提醒更新同居材料；「本次已更新」顺延一个周期。
                  客户详情=案件中心单页，此卡同时覆盖「案件页 / 客户页」两处语义面（另一处是概览的临近到期条）。 */}
              {showCohab && <CohabReminderCard caseId={selectedCase.id} months={cohabMonths} />}

              {/* 本案操作：编辑案件 + ⋯ 菜单（归档/删除收纳于此，与页面底部的客户级操作彻底分开） */}
              <div className="-mb-2 flex items-center justify-end gap-2.5">
                <Link
                  to={`/cases/${selectedCase.id}/edit`}
                  state={backSource}
                  className="text-[12.5px] font-semibold text-brand hover:text-brand-600 hover:underline"
                  title="编辑案件类型/担保/参与人等"
                >
                  编辑案件 ›
                </Link>
                <details ref={caseMenuRef} className="relative">
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
                        setConfirmingArchiveCase(true)
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
                          setConfirmingDeleteCase(true)
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
                {/* 案件大类 = cases.case_category（四值枚举，可空）；旧案件未填退 — */}
                <InfoRow label="案件大类">
                  {selectedCase.case_category && (
                    <span
                      title={selectedCase.case_category}
                      className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[12px] font-semibold text-emerald-700"
                    >
                      {selectedCase.case_category}
                    </span>
                  )}
                </InfoRow>
                {/* 案件类型 = cases.visa_subclass（级联派生入库值，如 482/SBS/820/801）+ 子类别(visa_stream) */}
                <InfoRow label="案件类型">
                  {formatVisaType(selectedCase.visa_subclass, selectedCase.visa_stream)}
                </InfoRow>
                {/* 级联子字段（cases.case_details JSON：评估机构/评估职位/用途/文件类型/ABN/就读院校…）逐键展示 */}
                {Object.entries(selectedCase.case_details ?? {}).map(
                  ([k, v]) =>
                    v && (
                      <InfoRow key={k} label={k}>
                        <span title={v}>{v}</span>
                      </InfoRow>
                    ),
                )}
                <InfoRow label="担保职位">{sponsorPosition}</InfoRow>
                <InfoRow label="担保雇主">
                  {sponsorEmployerId ? employer.data?.name ?? '…' : null}
                </InfoRow>
                <InfoRow label="介绍人" valueClass="text-rose-600">
                  {customer.referrer_id ? referrer.data?.name ?? '…' : null}
                </InfoRow>
                {/* 一案一组：参与客户可直接删减（✕ 移出 / + 添加），不必进编辑案件表单 */}
                <ParticipantManager
                  caseId={selectedCase.id}
                  participants={managerParticipants}
                  pageCustomerId={customer.id}
                  pageCustomerName={customer.full_name}
                  candidates={addCandidates}
                />
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
                {/* 两里程碑卡（窄屏堆叠，≥sm 并排）：审理时长 + 状态，与进度表同一来源（flowProcessing/statusColor） */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <MilestoneCard title="提名递交" dhaDays={dhaOf('nomination')} processing={nomP} status={nomStatus} />
                  <MilestoneCard title="签证递交" dhaDays={dhaOf('visa')} processing={visaP} status={visaStatus} />
                </div>
              </div>

              {/* 阶段进展（与案件详情页同一组件，UI 完全一致）：真实阶段链 + 推进阶段 + 阶段流转记录 */}
              <StageProgressCard caseRow={selectedCase} key={selectedCase.id} />

              {/* 本案待办（与案件详情页同一组件，功能完全一致：+添加 / 完成 / 删除 / 近期跟进）。
                  TRT 已升级为上方独立绿卡（带新建/不再提醒按钮），此处不再以待办行重复展示。 */}
              <CaseTodosCard caseRow={selectedCase} trt={{ show: false, months: 0 }} key={`todos-${selectedCase.id}`} />

              {/* 归档本案（可逆）：案件是整体，归档对所有参与人同时生效 */}
              <ConfirmDialog
                open={confirmingArchiveCase}
                title="确定归档该案件吗？"
                description={
                  <>
                    {participantNames.length > 1 && (
                      <>
                        本案共 {participantNames.length} 名参与人（{participantNames.join('、')}），
                        归档后<b>在所有参与人的档案里都会一并隐藏</b>。
                      </>
                    )}
                    归档不删数据，可在 <b>档案库 → 回收站</b> 一键恢复。
                  </>
                }
                confirmLabel="归档本案"
                pendingLabel="归档中…"
                pending={archiveM.isPending}
                onConfirm={() => {
                  setConfirmingArchiveCase(false)
                  archiveM.mutate(selectedCase.id)
                }}
                onClose={() => setConfirmingArchiveCase(false)}
              />

              {/* 彻底删除本案（不可恢复）：整案操作，对所有参与人同时生效 */}
              <ConfirmDialog
                open={confirmingDeleteCase}
                title={`彻底删除案件 ${selectedCase.case_number}（${formatVisaType(selectedCase.visa_subclass, selectedCase.visa_stream)}）？`}
                tone="danger"
                description={
                  <>
                    将连同其<b>递交记录、阶段历史、全部账目</b>一并永久删除，<b>不可恢复</b>。
                    {participantNames.length > 1 && (
                      <>
                        本案共 {participantNames.length} 名参与人（{participantNames.join('、')}），
                        <b>删除后所有参与人的档案里都不再有此案件</b>。
                      </>
                    )}
                    如只想暂时隐藏，请改用「归档本案」。
                  </>
                }
                confirmLabel="删除"
                pendingLabel="删除中…"
                pending={delM.isPending}
                onConfirm={() => {
                  setConfirmingDeleteCase(false)
                  delM.mutate(selectedCase.id)
                }}
                onClose={() => setConfirmingDeleteCase(false)}
              />
            </div>
          )}
        </>
      )}
    </Card>
  )
}
