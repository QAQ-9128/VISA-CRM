import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useArchiveCase, useCase, useCaseStageHistory, useCasesByCustomer } from '../../hooks/queries/useCases'
import { useDeleteCase } from '../../hooks/queries/useCases'
import { useCustomer, useCustomers } from '../../hooks/queries/useCustomers'
import { useCaseApplicants } from '../../hooks/queries/useCaseApplicants'
import { useEmployer } from '../../hooks/queries/useEmployers'
import { useReferrer } from '../../hooks/queries/useReferrers'
import { useRecordsByCase, useCreateRecord, useUpdateRecord, useDeleteRecord } from '../../hooks/queries/useRecords'
import { useDocumentsByCase } from '../../hooks/queries/useDocuments'
import { sortRecords } from '../../lib/records'
import { FOLLOW_UP_EMOJIS, DEFAULT_FOLLOW_UP_EMOJI } from '../../types/domain'
import { TextField } from '../../components/ui/TextField'
import { getAllPaymentPlans, getAllPayments } from '../../api/dashboard'
import { getAllPlanItems } from '../../api/payments'
import { queryKeys } from '../../hooks/queries/keys'
import { caseGroupCode, caseParticipantIds } from '../../lib/caseGroups'
import { selectCaseFeeGroups } from '../../lib/caseFees'
import { selectStagePath } from '../../lib/stagePath'
import { selectCaseTodos } from '../../lib/caseTodos'
import { shouldShowTrtReminder, monthsSinceGrant } from '../../lib/trt'
import { getLodgementLodgedDate } from '../../lib/lodgementStatus'
import { resolveBackLink } from '../../lib/backLink'
import { useBackSource } from '../../hooks/useBackSource'
import { formatMoney } from '../../lib/money'
import { CASE_STAGE_LABELS } from '../../types/domain'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { BackLink } from '../../components/ui/BackLink'
import { Card } from '../../components/ui/Card'
import { LoadingBlock, ErrorBlock } from '../../components/ui/states'
import { StageBadge } from '../../components/cases/StageBadge'
import { StageControl } from '../../components/cases/StageControl'
import { StageTimeline } from '../../components/cases/StageTimeline'
import { CaseFeesCard } from '../../components/customers/overview/CaseFeesCard'

/** 概要带的一格：标题 + 主值 + 副说明（发丝分隔）。 */
function Cell({ label, children, sub, subTone }: { label: string; children: ReactNode; sub?: ReactNode; subTone?: string }) {
  return (
    <div className="min-w-[10rem] flex-1 px-5 py-1 first:pl-2 last:pr-2">
      <div className="text-[11.5px] text-muted">{label}</div>
      <div className="mt-1 text-[14.5px] font-bold text-ink">{children}</div>
      {sub != null && <div className={`mt-0.5 text-[11.5px] ${subTone ?? 'text-faint'}`}>{sub}</div>}
    </div>
  )
}

/** 本案信息的一格：小标 + 值。 */
function InfoCell({ label, children, valueClass }: { label: string; children?: ReactNode; valueClass?: string }) {
  return (
    <div className="min-w-[8rem] flex-1">
      <div className="text-[11.5px] text-muted">{label}</div>
      <div className={`mt-1 truncate text-[14px] font-semibold ${valueClass ?? 'text-ink'}`}>{children || '—'}</div>
    </div>
  )
}

const TODO_TONE: Record<string, string> = {
  amber: 'text-amber-700',
  rose: 'text-rose-600',
  default: 'text-body',
}

/**
 * 「+ 添加」本案记录（与原记录 tab 同一 flow）：要么记一条**待办**（内容 + 可选截止日，
 * 默认指派给当前用户），要么记一条**带 emoji 的跟进**。保存走现有 useCreateRecord。
 */
function AddCaseRecordForm({ caseId, customerId, onDone }: { caseId: string; customerId: string; onDone: () => void }) {
  const create = useCreateRecord()
  const [type, setType] = useState<'task' | 'follow_up'>('task')
  const [content, setContent] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [emoji, setEmoji] = useState<string>(DEFAULT_FOLLOW_UP_EMOJI)
  const canSave = content.trim() !== ''

  function save(e: React.FormEvent) {
    e.preventDefault()
    if (!canSave) return
    create.mutate(
      {
        customer_id: customerId,
        case_id: caseId,
        type,
        content: content.trim(),
        due_date: type === 'task' ? dueDate || null : null,
        emoji_marker: type === 'follow_up' ? emoji : null,
      },
      { onSuccess: onDone },
    )
  }

  return (
    <form onSubmit={save} className="mt-3 space-y-2.5 rounded-[14px] border border-brand-100 bg-brand-50/40 p-3">
      {/* 类型段控：待办 / 跟进（emoji） */}
      <div className="inline-flex gap-1 rounded-full bg-surface-2 p-1">
        {(
          [
            { v: 'task', label: '记待办' },
            { v: 'follow_up', label: '记跟进' },
          ] as const
        ).map(({ v, label }) => (
          <button
            key={v}
            type="button"
            onClick={() => setType(v)}
            className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
              type === v ? 'bg-brand-700 text-white' : 'text-muted hover:text-body'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {type === 'follow_up' && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="跟进标记">
          {FOLLOW_UP_EMOJIS.map((em) => (
            <button
              key={em}
              type="button"
              onClick={() => setEmoji(em)}
              aria-pressed={emoji === em}
              className={`grid size-9 place-items-center rounded-full text-base transition-colors ${
                emoji === em ? 'bg-[var(--color-lime-soft)] ring-1 ring-[var(--color-lime-d)]' : 'bg-surface-2 hover:bg-brand-50'
              }`}
            >
              {em}
            </button>
          ))}
        </div>
      )}

      <TextField
        label={type === 'task' ? '待办内容 *' : '跟进内容 *'}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={type === 'task' ? '如：递交签证申请' : '如：已电话沟通补件清单'}
      />
      {type === 'task' && (
        <TextField label="截止日（可选）" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      )}

      {create.isError && <p className="text-sm text-[var(--color-coral)]">保存失败，请重试。</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={!canSave || create.isPending}>
          {create.isPending ? '保存中…' : '保存'}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>取消</Button>
      </div>
    </form>
  )
}

/**
 * 案件详情（单页，照「案件页面」设计图，无 tab）：
 * Header → 概要带四格（参与人 / 当前阶段 / 待办下一步 / 本案费用）→ 本案信息五项 →
 * 左（阶段进展·真实流转链 + 推进阶段 + 流转记录、本案待办）+ 右（费用记录 = 与客户页同一组件/同一份账，天然联动同源）。
 * 阶段链只画 case_stage_history 真实走过的节点（selectStagePath），绝不线性填充。
 */
export function CaseDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const source = useBackSource()
  const caseQuery = useCase(id)
  const c = caseQuery.data
  const owner = c?.customer_id
  const customer = useCustomer(owner)
  const customerCases = useCasesByCustomer(owner)
  const allCustomers = useCustomers({})
  const applicants = useCaseApplicants(c?.id)
  const stageHistory = useCaseStageHistory(c?.id)
  const caseRecords = useRecordsByCase(c?.id)
  const caseDocs = useDocumentsByCase(c?.id)
  const archive = useArchiveCase()
  const del = useDeleteCase()
  const [advancing, setAdvancing] = useState(false)
  // 本案待办：添加（待办 / emoji 跟进）+ 完成 / 删除（复用原记录 flow）
  const updateRecord = useUpdateRecord()
  const deleteRecord = useDeleteRecord()
  const [addingRecord, setAddingRecord] = useState(false)
  const followUps = useMemo(
    () => sortRecords(caseRecords.data ?? []).filter((r) => r.type === 'follow_up').slice(0, 5),
    [caseRecords.data],
  )

  // 担保（案件级，旧数据回退客户字段）
  const sponsorEmployerId = c?.sponsor_employer_id ?? customer.data?.sponsor_employer_id ?? null
  const employer = useEmployer(sponsorEmployerId)
  const referrer = useReferrer(customer.data?.referrer_id ?? null)

  // 费用（与客户页同一查询缓存 + 同一 selector → 数字必然一致）
  const plansQ = useQuery({ queryKey: queryKeys.dashboard.plans, queryFn: getAllPaymentPlans })
  const paymentsQ = useQuery({ queryKey: queryKeys.dashboard.payments, queryFn: getAllPayments })
  const planItemsQ = useQuery({ queryKey: queryKeys.dashboard.planItems, queryFn: getAllPlanItems })

  const customers = allCustomers.data ?? []
  const customerById = useMemo(() => Object.fromEntries(customers.map((x) => [x.id, x])), [customers])

  // 一案一组：参与人 = 案件客户 + 本案参与客户（case_applicants）；组码由参与人集合派生
  const memberIds = useMemo(
    () => (c ? caseParticipantIds(c, applicants.data ?? []) : []),
    [c, applicants.data],
  )
  const groupCode = c && memberIds.length ? caseGroupCode(memberIds, c.id) : ''
  const memberList = useMemo(
    () => memberIds.map((mid) => ({ id: mid, name: customerById[mid]?.full_name ?? '' })).filter((m) => m.name),
    [memberIds, customerById],
  )

  const feeTotals = useMemo(() => {
    if (!c) return null
    return selectCaseFeeGroups(c, memberIds, plansQ.data ?? [], paymentsQ.data ?? [], customerById, planItemsQ.data ?? []).totals
  }, [c, memberIds, plansQ.data, paymentsQ.data, customerById, planItemsQ.data])

  // 阶段链（真实流转，非线性）+ 提名递交日期
  const hist = useMemo(() => stageHistory.data ?? [], [stageHistory.data])
  const stagePath = useMemo(() => (c ? selectStagePath(hist, c.current_stage) : []), [hist, c])
  const nomDate = useMemo(() => getLodgementLodgedDate(hist, 'nomination'), [hist])

  // 本案待办（TRT / 到期文件 / 本案记录派生）
  const showTrt = c ? shouldShowTrtReminder(c, customerCases.data ?? [c], hist) : false
  const trtMonths = showTrt ? monthsSinceGrant(hist) ?? 0 : 0
  const todos = useMemo(
    () => selectCaseTodos({ records: caseRecords.data ?? [], docs: caseDocs.data ?? [], trt: { show: showTrt, months: trtMonths } }),
    [caseRecords.data, caseDocs.data, showTrt, trtMonths],
  )

  if (caseQuery.isPending) return <LoadingBlock />
  if (caseQuery.isError) return <ErrorBlock error={caseQuery.error} />
  if (!c) {
    return (
      <div className="mx-auto max-w-2xl text-center text-muted">
        案件不存在或已被删除。
        <div className="mt-4">
          <Link to="/cases" className="font-semibold text-brand hover:underline">返回案件列表</Link>
        </div>
      </div>
    )
  }

  function handleArchive() {
    if (!window.confirm('确定归档该案件吗？归档后默认不显示，可随时恢复。')) return
    archive.mutate(c!.id, { onSuccess: () => navigate(`/customers/${c!.customer_id}`) })
  }
  function handleDelete() {
    if (!window.confirm('彻底删除该案件？\n\n将连同其递交记录、阶段历史、账目一并【永久删除，不可恢复】！\n如只想暂时隐藏，请用「归档案件」。')) return
    del.mutate(c!.id, { onSuccess: () => navigate(`/customers/${c!.customer_id}`) })
  }

  const back = resolveBackLink(location.state, { to: '/cases', label: '返回案件列表' })
  const lastIdx = stagePath.length - 1

  return (
    <section className="space-y-5">
      <BackLink to={back.to} label={back.label} />

      {/* Header：衬线标题 + 客户 · 国家 · Group · 当前阶段 + 编辑案件 */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-serif text-2xl font-bold tracking-[-0.01em] text-ink">
              {c.visa_subclass}
              {c.visa_stream ? ` / ${c.visa_stream}` : ''} 签证
            </h1>
            {c.is_archived && <Badge className="bg-slate-200 text-slate-600">已归档</Badge>}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm text-muted">
            {/* 参与人平铺（无归属/主导之分），各自链到客户档案 */}
            <span className="inline-flex flex-wrap items-center">
              {memberList.length === 0 ? (
                <Link to={`/customers/${c.customer_id}`} state={source} className="font-semibold text-brand hover:underline">
                  {customer.data?.full_name ?? '…'}
                </Link>
              ) : (
                memberList.map((m, i) => (
                  <span key={m.id} className="inline-flex items-center">
                    {i > 0 && <span aria-hidden>、</span>}
                    <Link to={`/customers/${m.id}`} state={source} className="font-semibold text-brand hover:underline">
                      {m.name}
                    </Link>
                  </span>
                ))
              )}
            </span>
            {c.destination_country && (
              <>
                <span aria-hidden>·</span>
                <span>{c.destination_country}</span>
              </>
            )}
            <span aria-hidden>·</span>
            <span className="font-semibold text-brand" title="本案参与人组（一案一组）">
              Group {groupCode}
            </span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1.5">
              当前阶段 <StageBadge stage={c.current_stage} />
            </span>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link to={`/cases/${c.id}/edit`}>
            <Button variant="secondary">编辑案件</Button>
          </Link>
        </div>
      </div>

      {/* 概要带：参与人 / 当前阶段 / 本案待办·下一步 / 本案费用 */}
      <div className="rounded-card bg-white p-[18px] shadow-soft">
        <div className="flex flex-wrap divide-x divide-line">
          <Cell label="本案参与人" sub={`共 ${Math.max(memberList.length, 1)} 人 · 进度一致`}>
            <span className="flex items-center gap-2">
              <span className="flex -space-x-2">
                {memberList.slice(0, 3).map((m) => (
                  <span key={m.id} className="rounded-full ring-2 ring-white">
                    <Avatar name={m.name} seed={m.id} size={26} />
                  </span>
                ))}
              </span>
              <span className="truncate">{memberList.map((m) => m.name).join('、') || customer.data?.full_name || '—'}</span>
            </span>
          </Cell>
          <Cell label="当前阶段" sub={`提名递交 ${nomDate ?? '—'}`}>
            <StageBadge stage={c.current_stage} />
          </Cell>
          <Cell label="本案待办 · 下一步" sub={`共 ${todos.length} 项待办`}>
            {todos[0]?.text ?? <span className="text-faint">暂无待办</span>}
          </Cell>
          <Cell label="本案费用（与客户联动）">
            {feeTotals ? (
              <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span className="text-[11.5px] font-normal text-muted">应收</span>
                <span className="tabular-nums">{formatMoney(feeTotals.receivable, c.currency)}</span>
                <span className="text-[11.5px] font-normal text-muted">已收</span>
                <span className="tabular-nums text-brand">{formatMoney(feeTotals.paid, c.currency)}</span>
                <span className="text-[11.5px] font-normal text-muted">未收</span>
                <span className={`tabular-nums ${feeTotals.unpaid > 0 ? 'text-[var(--color-coral)]' : 'text-faint'}`}>
                  {formatMoney(feeTotals.unpaid, c.currency)}
                </span>
              </span>
            ) : (
              <span className="text-faint">…</span>
            )}
          </Cell>
        </div>
      </div>

      {/* 本案信息（整条，全展示；缺的留 —） */}
      <Card>
        <h2 className="border-l-[3px] border-brand pl-2 font-serif text-[15px] font-bold text-ink">本案信息</h2>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
          <InfoCell label="签证类型">Subclass {c.visa_subclass}</InfoCell>
          <InfoCell label="签证子类别" valueClass="text-brand-600">{c.visa_stream}</InfoCell>
          <InfoCell label="担保职位">{c.sponsor_position ?? customer.data?.sponsor_position}</InfoCell>
          <InfoCell label="担保雇主">{sponsorEmployerId ? employer.data?.name ?? '…' : null}</InfoCell>
          <InfoCell label="介绍人" valueClass="text-[var(--color-coral)]">
            {customer.data?.referrer_id ? referrer.data?.name ?? '…' : null}
          </InfoCell>
        </div>
      </Card>

      {/* 左：阶段进展 + 本案待办 ｜ 右：费用记录（与客户页同一组件 = 同一份账） */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card>
            <div className="flex flex-wrap items-baseline gap-2">
              <h2 className="border-l-[3px] border-brand pl-2 font-serif text-[15px] font-bold text-ink">阶段进展</h2>
              <span className="text-[11.5px] text-faint">按实际记录，没走的阶段不显示</span>
            </div>

            {/* 真实流转链（非线性）：节点 = 实际走过的阶段 + 实际日期；当前节点高亮 */}
            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              {stagePath.map((n, i) => (
                <span key={`${n.stage}-${i}`} className="flex items-center gap-2">
                  {i > 0 && <span aria-hidden className="text-line-2">→</span>}
                  <span
                    className={`rounded-[12px] px-3 py-1.5 text-center ${
                      i === lastIdx
                        ? 'border border-[var(--color-lime-d)] bg-[var(--color-lime-soft)]'
                        : i === 0 && n.date === null
                          ? 'bg-surface-2'
                          : 'bg-[var(--color-lime-soft)]'
                    }`}
                  >
                    <span className={`block text-[13px] font-semibold ${i === lastIdx ? 'text-[var(--color-lime-ink)]' : 'text-body'}`}>
                      {CASE_STAGE_LABELS[n.stage]}
                    </span>
                    <span className="block text-[10.5px] text-faint tabular-nums">
                      {i === lastIdx ? `当前${n.date ? ` · ${n.date}` : ''}` : n.date ?? ''}
                    </span>
                  </span>
                </span>
              ))}
            </div>

            {/* 推进阶段：展开切换表单（任意阶段含拒签/撤签 + 实际日期默认今天可补录） */}
            <div className="mt-4">
              {advancing ? (
                <div>
                  {/* 无「同步主案件」锁定：本案进度全员共享，任何时候都可直接编辑 */}
                  <StageControl caseId={c.id} currentStage={c.current_stage} />
                  <button type="button" onClick={() => setAdvancing(false)} className="mt-2 text-[12.5px] font-semibold text-muted hover:text-ink">
                    收起
                  </button>
                </div>
              ) : (
                <Button onClick={() => setAdvancing(true)}>推进阶段 →</Button>
              )}
            </div>

            {/* 阶段流转记录（真实历史） */}
            <div className="mt-4 border-t border-line pt-3">
              <h3 className="text-[13px] font-bold text-ink">阶段流转记录</h3>
              <div className="mt-2">
                <StageTimeline caseId={c.id} />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-2">
              <h2 className="border-l-[3px] border-brand pl-2 font-serif text-[15px] font-bold text-ink">本案待办 · 要做的事</h2>
              {!addingRecord && (
                <button
                  type="button"
                  onClick={() => setAddingRecord(true)}
                  className="shrink-0 rounded-full border border-dashed border-brand/55 px-3 py-1 text-[12px] font-semibold text-brand-700 transition-colors hover:bg-brand-50"
                >
                  + 添加
                </button>
              )}
            </div>

            {/* + 添加：要么记待办，要么记带 emoji 的跟进（复用原记录 flow） */}
            {addingRecord && <AddCaseRecordForm caseId={c.id} customerId={c.customer_id} onDone={() => setAddingRecord(false)} />}

            {todos.length === 0 ? (
              <p className="mt-3 text-sm text-faint">本案暂无待办</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {todos.map((t) => {
                  const recordId = t.kind === 'task' ? t.id.slice('task-'.length) : null
                  return (
                    <li key={t.id} className="flex items-center gap-2.5 text-sm">
                      <span aria-hidden>{t.kind === 'trt' ? '⚠️' : t.kind === 'expiry' ? '📎' : '☑️'}</span>
                      <span className={`min-w-0 flex-1 truncate ${TODO_TONE[t.tone]}`}>
                        {t.text}
                        {t.sub && <span className="text-[11.5px] text-faint"> · {t.sub}</span>}
                      </span>
                      {t.badge ? (
                        <span className={`shrink-0 text-[12px] font-semibold ${t.tone === 'rose' ? 'text-rose-600' : 'text-faint'}`}>{t.badge}</span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-[var(--color-mute-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-mute-tx)]">待办</span>
                      )}
                      {/* 待办（记录派生）行内操作：完成 / 删除（复用原记录 flow） */}
                      {recordId && (
                        <span className="flex shrink-0 items-center gap-2 text-[12px] font-semibold">
                          <button
                            type="button"
                            disabled={updateRecord.isPending}
                            onClick={() => updateRecord.mutate({ id: recordId, patch: { is_done: true, done_at: new Date().toISOString() } })}
                            className="text-brand hover:text-brand-600 disabled:opacity-50"
                          >
                            完成
                          </button>
                          <button
                            type="button"
                            disabled={deleteRecord.isPending}
                            onClick={() => { if (window.confirm('删除这条待办？')) deleteRecord.mutate(recordId) }}
                            className="text-faint hover:text-[var(--color-coral)] disabled:opacity-50"
                          >
                            删除
                          </button>
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

            {/* 近期跟进（带 emoji 的记录） */}
            {followUps.length > 0 && (
              <div className="mt-3 border-t border-line pt-2.5">
                <h3 className="text-[12px] font-bold text-muted">近期跟进</h3>
                <ul className="mt-1.5 space-y-1.5">
                  {followUps.map((r) => (
                    <li key={r.id} className="flex items-center gap-2 text-[13px]">
                      <span aria-hidden>{r.emoji_marker || DEFAULT_FOLLOW_UP_EMOJI}</span>
                      <span className="min-w-0 flex-1 truncate text-body">{r.content}</span>
                      <span className="shrink-0 text-[11px] text-faint tabular-nums">{(r.created_at ?? '').slice(0, 10)}</span>
                      <button
                        type="button"
                        disabled={deleteRecord.isPending}
                        onClick={() => { if (window.confirm('删除这条跟进？')) deleteRecord.mutate(r.id) }}
                        className="shrink-0 text-[12px] font-semibold text-faint hover:text-[var(--color-coral)] disabled:opacity-50"
                      >
                        删除
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </div>

        {/* 右：费用记录 —— 与客户详情同一组件、同一查询缓存与算法 → 同一笔账两页一致、双向同步 */}
        <CaseFeesCard caseRow={c} sourceNote="与客户/财务联动同源" />
      </div>

      {/* 底部：归档 / 彻底删除 */}
      <div className="flex gap-3 border-t border-line pt-4">
        <Button variant="ghost" onClick={handleArchive} disabled={archive.isPending}>
          {c.is_archived ? '已归档' : '归档案件'}
        </Button>
        <Button variant="ghost" onClick={handleDelete} disabled={del.isPending} className="text-rose-600 hover:bg-rose-50">
          {del.isPending ? '删除中…' : '彻底删除'}
        </Button>
      </div>
    </section>
  )
}
