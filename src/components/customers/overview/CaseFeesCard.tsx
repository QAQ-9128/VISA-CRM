import { useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card } from '../../ui/Card'
import { Select } from '../../ui/Select'
import { TextField } from '../../ui/TextField'
import { Button } from '../../ui/Button'
import { getAllPaymentPlans, getAllPayments } from '../../../api/dashboard'
import { getAllPlanItems } from '../../../api/payments'
import { getDocumentSignedUrl } from '../../../api/documents'
import { useDocumentsByCase, useAddDocument, useArchiveDocument } from '../../../hooks/queries/useDocuments'
import { useCustomers } from '../../../hooks/queries/useCustomers'
import { useCaseApplicants } from '../../../hooks/queries/useCaseApplicants'
import { useCreatePayment, useCreatePaymentPlan, useCreatePlanItem, useDeletePayment } from '../../../hooks/queries/usePayments'
import { queryKeys } from '../../../hooks/queries/keys'
import { caseParticipantIds } from '../../../lib/caseGroups'
import { selectCaseFeeGroups } from '../../../lib/caseFees'
import type { CaseFeeGroup, CaseFeeLine, FeeLineStatus } from '../../../lib/caseFees'
import { formatMoney } from '../../../lib/money'
import { FEE_CATEGORIES, FEE_CATEGORY_OTHER, PAYMENT_METHOD_LABELS } from '../../../types/domain'
import type { PaymentMethod } from '../../../types/domain'
import type { Case, Customer, Payment } from '../../../types/models'

// 状态 pill：派生自真实收款，不存字段。已收款=green-bg/green-d；待付款=中性灰。
// 本卡 = 客户应收视图（仅 from_client）；应付/双流总账在案件「付款 tab」，此处不出现。
const RECV_PILL: Record<FeeLineStatus, { cls: string; label: string }> = {
  unset: { cls: 'bg-surface-2 text-faint', label: '未设应收' },
  settled: { cls: 'bg-brand-50 text-brand-600', label: '已收款' },
  owing: { cls: 'bg-[var(--color-mute-bg)] text-[var(--color-mute-tx)]', label: '待付款' },
}

/** 收款方式（与现有「记收款」一致）。 */
const RECEIPT_METHODS: PaymentMethod[] = ['cash', 'transfer', 'advance']
import { todayYmd } from '../../../lib/dateRules'

// 录款默认日期取本地日历日——toISOString 是 UTC 日，本地清晨会落到昨天甚至上个月，污染月度账目
const todayStr = todayYmd
const trimOrNull = (s: string) => (s.trim() === '' ? null : s.trim())

/** 该行（应收款项）对应的真实收款：款项 id 唯一定位（撤销用）。 */
function paymentsForLine(line: CaseFeeLine, casePayments: Payment[]): Payment[] {
  return casePayments.filter((p) => p.plan_item_id === line.planItemId)
}

/**
 * 新增款项（仅登记应收，未发生收款 → 列表显示「待付款」）。
 * 保存复用现有 useCreatePlanItem（无计划先 useCreatePaymentPlan 懒建，applicant_id=本组绑定口径）。
 */
function AddFeeItemForm({
  caseId,
  planId,
  billingApplicantId,
  onDone,
}: {
  caseId: string
  planId: string | null
  billingApplicantId: string | null
  onDone: () => void
}) {
  const createPlan = useCreatePaymentPlan(caseId)
  const createItem = useCreatePlanItem()
  const [cat, setCat] = useState<string>(FEE_CATEGORIES[0])
  const [other, setOther] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const resolved = cat === FEE_CATEGORY_OTHER ? other.trim() : cat
  const pending = createPlan.isPending || createItem.isPending
  const canSave = resolved !== '' && amount.trim() !== '' && Number(amount) > 0

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!canSave) return
    let pid = planId
    if (!pid) {
      const plan = await createPlan.mutateAsync({ case_id: caseId, applicant_id: billingApplicantId })
      pid = plan.id
    }
    await createItem.mutateAsync({ plan_id: pid, fee_category: resolved, amount_due: Number(amount), note: trimOrNull(note) })
    onDone()
  }

  return (
    <form onSubmit={save} className="mt-2 space-y-2.5 rounded-[14px] border border-brand-100 bg-brand-50/40 p-3">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Select
          label="款项类型" required
          options={[...FEE_CATEGORIES.map((c) => ({ value: c, label: c })), { value: FEE_CATEGORY_OTHER, label: '其他（手填）' }]}
          value={cat}
          onChange={(e) => setCat(e.target.value)}
        />
        <TextField label="金额" required type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      {cat === FEE_CATEGORY_OTHER && (
        <TextField label="其他类型" value={other} onChange={(e) => setOther(e.target.value)} placeholder="如：公证费" />
      )}
      <TextField label="备注（选填）" value={note} onChange={(e) => setNote(e.target.value)} />
      {(createPlan.isError || createItem.isError) && <p className="text-sm text-[var(--color-coral)]">保存失败，请重试。</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={!canSave || pending}>{pending ? '保存中…' : '保存款项'}</Button>
        <Button type="button" variant="ghost" onClick={onDone}>取消</Button>
      </div>
    </form>
  )
}

/**
 * 记收款（两步录入第 2 步）：金额(默认应收/未收，可改) / 实际日期(默认今天，可补录) / 方式 /
 * 上传发票(选填 → 存本案发票 documents：customer_id+case_id+doc_type=invoice) / 备注。
 * 保存复用现有 useCreatePayment（from_client，applicant_id=本组绑定口径），状态自动翻「已收款」。
 */
function ReceiptForm({
  caseId,
  customerId,
  line,
  billingApplicantId,
  currency,
  onDone,
}: {
  caseId: string
  /** 案件主申 id（发票归档到本案该客户名下） */
  customerId: string
  line: CaseFeeLine
  billingApplicantId: string | null
  currency: string
  onDone: () => void
}) {
  const create = useCreatePayment(caseId)
  const addDoc = useAddDocument()
  const fileRef = useRef<HTMLInputElement>(null)
  const [amount, setAmount] = useState(String(line.unpaid > 0 ? line.unpaid : line.amount))
  const [paidAt, setPaidAt] = useState(todayStr())
  const [method, setMethod] = useState<PaymentMethod>('transfer')
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const pending = create.isPending || addDoc.isPending
  const canSave = amount.trim() !== '' && Number(amount) > 0

  function save(e: FormEvent) {
    e.preventDefault()
    if (!canSave) return
    create.mutate(
      {
        case_id: caseId,
        applicant_id: billingApplicantId,
        direction: 'from_client',
        plan_item_id: line.planItemId,
        amount: Number(amount),
        currency,
        method,
        paid_at: paidAt || null,
        note: trimOrNull(note),
        fee_category: line.label,
      },
      {
        onSuccess: () => {
          // 发票（选填）：复用现有 documents 上传 flow，打 customer_id + case_id
          if (file) addDoc.mutate({ file, customer_id: customerId, case_id: caseId, doc_type: 'invoice' })
          onDone()
        },
      },
    )
  }

  return (
    <form onSubmit={save} className="mt-2 space-y-2.5 rounded-[14px] border border-brand-100 bg-brand-50/40 p-3">
      <p className="text-[13px] font-semibold text-ink">记收款 · {line.label}</p>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <TextField label={`金额（${currency}）`} required type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <TextField label="实际日期" required type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
        <Select
          label="方式" required
          options={RECEIPT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))}
          value={method}
          onChange={(e) => setMethod(e.target.value as PaymentMethod)}
        />
      </div>
      <TextField label="备注（选填）" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex items-center gap-2 text-[13px]">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded-full border border-dashed border-brand/55 px-3 py-1 text-[12px] font-semibold text-brand-700 hover:bg-brand-50"
        >
          {file ? `📎 ${file.name}` : '+ 上传发票（选填）'}
        </button>
        {file && (
          <button type="button" onClick={() => setFile(null)} className="text-faint hover:text-[var(--color-coral)]">
            移除
          </button>
        )}
        <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </div>
      {create.isError && <p className="text-sm text-[var(--color-coral)]">保存失败，请重试。</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={!canSave || pending}>{pending ? '保存中…' : '确认收款'}</Button>
        <Button type="button" variant="ghost" onClick={onDone}>取消</Button>
      </div>
    </form>
  )
}

/** 一行：款项 / 金额 / 状态 / 操作。待付款 → 记收款(实心绿)；已收款 → …(查看/撤销/补记)。 */
function FeeRow({
  line,
  caseId,
  customerId,
  billingApplicantId,
  currency,
  payments,
  onUndo,
  undoPending,
}: {
  line: CaseFeeLine
  caseId: string
  customerId: string
  billingApplicantId: string | null
  currency: string
  payments: Payment[]
  onUndo: (paymentId: string) => void
  undoPending: boolean
}) {
  const [openPanel, setOpenPanel] = useState(false)
  const [openReceipt, setOpenReceipt] = useState(false)
  const pill = RECV_PILL[line.status]
  const settled = line.status === 'settled'
  return (
    <div className="border-b border-line last:border-0">
      <div className="flex items-center gap-3 py-2.5">
        <span className="min-w-0 flex-1 truncate text-sm text-ink">{line.label}</span>
        {/* 金额：应收 ink；已收 green */}
        <span className={`shrink-0 text-sm font-medium tabular-nums ${settled ? 'text-brand' : 'text-ink'}`}>
          {formatMoney(line.amount, currency)}
        </span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${pill.cls}`}>{pill.label}</span>
        {settled ? (
          <button
            type="button"
            onClick={() => setOpenPanel((o) => !o)}
            aria-label="查看 / 撤销"
            aria-expanded={openPanel}
            className="grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
          >
            …
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setOpenReceipt((o) => !o)}
            className="shrink-0 rounded-full bg-brand-700 px-3 py-1 text-[12px] font-semibold text-white transition-colors hover:bg-brand-800"
          >
            记收款
          </button>
        )}
      </div>

      {/* 已收款：查看该行真实收款明细 + 撤销（复用现有 useDeletePayment）；可补记/修正 */}
      {openPanel && settled && (
        <div className="mb-2 space-y-1 rounded-[12px] bg-surface-2 p-2.5">
          {payments.length === 0 ? (
            <p className="text-[12px] text-faint">无可撤销的收款记录</p>
          ) : (
            payments.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-[12px]">
                <span className="text-faint tabular-nums">{(p.paid_at ?? '').slice(0, 10)}</span>
                <span className="flex-1 tabular-nums text-ink">{formatMoney(Number(p.amount), p.currency || currency)}</span>
                <span className="text-faint">{PAYMENT_METHOD_LABELS[p.method as PaymentMethod] ?? p.method}</span>
                <button
                  type="button"
                  onClick={() => onUndo(p.id)}
                  disabled={undoPending}
                  className="font-semibold text-[var(--color-coral)] hover:underline disabled:opacity-50"
                >
                  撤销
                </button>
              </div>
            ))
          )}
          <button type="button" onClick={() => setOpenReceipt(true)} className="pt-0.5 text-[12px] font-semibold text-brand hover:text-brand-600">
            + 记一笔 / 修正
          </button>
        </div>
      )}

      {openReceipt && (
        <ReceiptForm
          caseId={caseId}
          customerId={customerId}
          line={line}
          billingApplicantId={billingApplicantId}
          currency={currency}
          onDone={() => setOpenReceipt(false)}
        />
      )}
    </div>
  )
}

/** 一个参与人分组：人名深绿整条 chip(▾) + 款项行 + 「[姓名] 小计」 + 「+ 给 [姓名] 添加款项」。 */
function FeeGroupBlock({
  group,
  caseId,
  customerId,
  currency,
  casePayments,
  onUndo,
  undoPending,
}: {
  group: CaseFeeGroup
  caseId: string
  customerId: string
  currency: string
  casePayments: Payment[]
  onUndo: (paymentId: string) => void
  undoPending: boolean
}) {
  const [adding, setAdding] = useState(false)
  // 组头真折叠（之前 ▾ 是装饰）：多人案件费用卡很长，可按人收起；默认展开
  const [collapsed, setCollapsed] = useState(false)
  return (
    <div>
      {/* 组头：参与人姓名（green-deep 整条，无主/副申标签）；点击折叠/展开本人款项 */}
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        className="flex w-full items-center gap-1.5 rounded-[10px] bg-brand-700 px-3.5 py-1.5 text-left text-[13px] font-semibold text-white hover:bg-brand-800"
      >
        {group.participantName || '—'}
        {collapsed && group.lines.length > 0 && (
          <span className="text-[11px] font-medium text-white/80">
            {group.lines.length} 项 · 未收 {formatMoney(group.unpaid, currency)}
          </span>
        )}
        <span aria-hidden className={`ml-auto text-[10px] opacity-80 transition-transform ${collapsed ? '-rotate-90' : ''}`}>▾</span>
      </button>

      {!collapsed && (
        <div>
          {group.lines.length === 0 ? (
            <p className="py-2.5 text-sm text-faint">本人暂无费用</p>
          ) : (
            group.lines.map((line) => (
              <FeeRow
                key={`r-${line.planItemId}`}
                line={line}
                caseId={caseId}
                customerId={customerId}
                billingApplicantId={group.applicantId}
                currency={currency}
                payments={paymentsForLine(line, casePayments)}
                onUndo={onUndo}
                undoPending={undoPending}
              />
            ))
          )}
        </div>
      )}

      {/* [姓名] 小计：应收 / 已收 / 未收（from_client 口径，现有派生函数求和） */}
      {!collapsed && group.lines.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 border-t border-line py-2 text-[12px]">
          <span className="font-semibold text-ink">{group.participantName} 小计</span>
          <span className="text-muted">
            应收 <b className="font-semibold tabular-nums text-ink">{formatMoney(group.receivable, currency)}</b>
          </span>
          <span className="text-muted">
            已收 <b className="font-semibold tabular-nums text-brand">{formatMoney(group.paid, currency)}</b>
          </span>
          <span className="text-muted">
            未收 <b className={`font-semibold tabular-nums ${group.unpaid > 0 ? 'text-[var(--color-coral)]' : 'text-faint'}`}>{formatMoney(group.unpaid, currency)}</b>
          </span>
        </div>
      )}

      {/* + 给 [姓名] 添加款项（仅登记应收 → 待付款）；无全局选人下拉 */}
      {!collapsed &&
        (adding ? (
          <AddFeeItemForm caseId={caseId} planId={group.planId} billingApplicantId={group.applicantId} onDone={() => setAdding(false)} />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="py-1.5 text-[12.5px] font-semibold text-brand hover:text-brand-600"
          >
            + 给 {group.participantName} 添加款项
          </button>
        ))}
    </div>
  )
}

/**
 * 🧾 本案发票：列本案 doc_type='invoice' 的文件（文件名可点开签名 URL + 删除）+ 「+ 上传发票」。
 * 复用现有 documents flow（customer_id+case_id），随选中案件切换只显本案发票，不新建存储。
 */
function CaseInvoices({ caseId, customerId }: { caseId: string; customerId: string }) {
  const docsQ = useDocumentsByCase(caseId)
  const add = useAddDocument()
  const archive = useArchiveDocument()
  const fileRef = useRef<HTMLInputElement>(null)

  const invoices = useMemo(
    () => (docsQ.data ?? []).filter((d) => d.doc_type === 'invoice' && !d.is_archived),
    [docsQ.data],
  )

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    add.mutate({ file, customer_id: customerId, case_id: caseId, doc_type: 'invoice' })
    e.target.value = ''
  }
  async function open(storagePath: string | null) {
    if (!storagePath) return
    const url = await getDocumentSignedUrl(storagePath)
    window.open(url, '_blank', 'noopener')
  }

  return (
    <div className="mt-4 border-t border-line pt-3">
      <h3 className="font-serif text-[14px] font-bold text-ink">
        <span aria-hidden className="mr-1">🧾</span>本案发票
      </h3>
      {invoices.length === 0 ? (
        <p className="mt-2 text-center text-[12.5px] text-faint">本案暂无发票</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {invoices.map((d) => (
            <li key={d.id} className="flex items-center gap-2 text-sm">
              <span aria-hidden>📄</span>
              <button
                type="button"
                onClick={() => void open(d.storage_path)}
                disabled={!d.storage_path}
                className="min-w-0 flex-1 truncate text-left text-ink hover:text-brand hover:underline disabled:cursor-default disabled:no-underline"
                title={d.file_name ?? undefined}
              >
                {d.file_name ?? d.title ?? '（未命名发票）'}
              </button>
              <button
                type="button"
                onClick={() => archive.mutate(d.id)}
                disabled={archive.isPending}
                className="shrink-0 text-[12px] font-medium text-faint hover:text-[var(--color-coral)]"
              >
                删除
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={add.isPending}
        className="mt-2.5 flex min-h-10 w-full items-center justify-center gap-1.5 rounded-[12px] border border-dashed border-brand/55 bg-brand-50/30 text-[13px] font-semibold text-brand-700 transition-colors hover:bg-brand-50 disabled:opacity-50"
      >
        {add.isPending ? '上传中…' : '+ 上传发票'}
      </button>
      <input ref={fileRef} type="file" className="hidden" onChange={onPick} />
    </div>
  )
}

/**
 * ③ 费用记录卡（本案 · 按人拆分 · 与财务同源）—— 客户应收视图，对照「费用.png」。
 * 分组覆盖**本案全部参与人**（= 案件所属组成员，与案件页顶部「本案参与人」同源）——没记款的也出空分组、可加款。
 * 合并(sync_tracking=true)只差记账口径：合并/遗留 null 款显示在案件客户名下、其加款仍写 applicant_id=null。
 * 列：款项/金额/状态/操作；每组末「小计」、组下「+ 给 X 添加款项」；底部「本案合计(全部客户)」。
 * 账目算法零改动（getCaseTotals/receivableStatus 派生），录入复用现有 createPlanItem/createPayment。
 */
export function CaseFeesCard({
  caseRow,
  sourceNote = '与财务同源',
}: {
  caseRow: Case | null
  /** 副标来源说明：客户页默认「与财务同源」，案件页传「与客户/财务联动同源」 */
  sourceNote?: string
}) {
  const plansQ = useQuery({ queryKey: queryKeys.dashboard.plans, queryFn: getAllPaymentPlans })
  const paymentsQ = useQuery({ queryKey: queryKeys.dashboard.payments, queryFn: getAllPayments })
  const planItemsQ = useQuery({ queryKey: queryKeys.dashboard.planItems, queryFn: getAllPlanItems })
  const customersQ = useCustomers({})
  const applicantsQ = useCaseApplicants(caseRow?.id)

  const customerById = useMemo<Record<string, Customer>>(
    () => Object.fromEntries((customersQ.data ?? []).map((c) => [c.id, c])),
    [customersQ.data],
  )

  // 一案一组：参与人 = 案件客户 + 本案参与客户（case_applicants），与案件页顶部「本案参与人」同源
  const groupMemberIds = useMemo(
    () => (caseRow ? caseParticipantIds(caseRow, applicantsQ.data ?? []) : []),
    [caseRow, applicantsQ.data],
  )

  const fees = useMemo(() => {
    if (!caseRow) return null
    return selectCaseFeeGroups(
      caseRow,
      groupMemberIds,
      plansQ.data ?? [],
      paymentsQ.data ?? [],
      customerById,
      planItemsQ.data ?? [],
    )
  }, [caseRow, groupMemberIds, plansQ.data, paymentsQ.data, customerById, planItemsQ.data])

  // 本案收款（「…」撤销定位）+ 删除一笔（复用现有 useDeletePayment）
  const del = useDeletePayment(caseRow?.id ?? '')
  const casePayments = useMemo(
    () => (paymentsQ.data ?? []).filter((p) => p.case_id === (caseRow?.id ?? '')),
    [paymentsQ.data, caseRow?.id],
  )
  const handleUndo = (id: string) => {
    if (window.confirm('确定撤销这笔收款吗？将删除该收款记录（状态与合计随之回退），不可恢复。')) del.mutate(id)
  }

  if (!caseRow) {
    return (
      <Card className="h-full">
        <h2 className="font-serif text-[17px] font-bold text-ink">费用记录</h2>
        <p className="mt-3 text-sm text-faint">该客户暂无案件，先新建案件再记账。</p>
      </Card>
    )
  }
  const cur = caseRow.currency || 'AUD'
  const loading = plansQ.isPending || paymentsQ.isPending || planItemsQ.isPending || applicantsQ.isPending || customersQ.isPending

  return (
    <Card className="h-full">
      <div className="mb-1 flex items-center gap-2">
        <h2 className="font-serif text-[18px] font-bold tracking-[-0.01em] text-ink">
          <span aria-hidden className="mr-1.5">💳</span>费用记录
        </h2>
        <span className="rounded-full bg-[var(--color-lime-soft)] px-2.5 py-0.5 text-[12px] font-semibold text-[var(--color-lime-ink)]">
          {caseRow.visa_subclass}
        </span>
      </div>
      <p className="mb-3 text-[12px] text-faint">本案 · 按人拆分 · {sourceNote}</p>

      {loading || !fees ? (
        <p className="text-sm text-faint">加载费用数据…</p>
      ) : (
        <>
          {/* 列头：款项 / 金额 / 状态 / 操作 */}
          <div className="flex items-center gap-3 border-b border-line pb-1.5 text-[11px] text-faint">
            <span className="min-w-0 flex-1">款项</span>
            <span className="shrink-0">金额</span>
            <span className="shrink-0">状态</span>
            <span className="shrink-0">操作</span>
          </div>

          <div className="mt-2.5 space-y-3.5">
            {fees.groups.map((g) => (
              <FeeGroupBlock
                key={g.participantId}
                group={g}
                caseId={caseRow.id}
                customerId={caseRow.customer_id}
                currency={cur}
                casePayments={casePayments}
                onUndo={handleUndo}
                undoPending={del.isPending}
              />
            ))}
          </div>

          {/* 🧾 本案发票 */}
          <CaseInvoices caseId={caseRow.id} customerId={caseRow.customer_id} />

          {/* 本案合计（全部客户）= Σ各人小计（现有派生函数按案求和） */}
          <div className="mt-4 border-t border-line pt-3">
            <div className="mb-1.5 font-serif text-[14px] font-bold text-ink">本案合计（全部客户）</div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-[11.5px] text-muted">应收合计</div>
                <div className="font-serif text-[20px] font-bold tabular-nums text-ink">{formatMoney(fees.totals.receivable, cur)}</div>
              </div>
              <div>
                <div className="text-[11.5px] text-muted">已收</div>
                <div className="font-serif text-[20px] font-bold tabular-nums text-brand">{formatMoney(fees.totals.paid, cur)}</div>
              </div>
              <div className="text-right">
                <div className="text-[11.5px] text-muted">未收</div>
                <div className={`font-serif text-[20px] font-bold tabular-nums ${fees.totals.unpaid > 0 ? 'text-[var(--color-coral)]' : 'text-faint'}`}>
                  {formatMoney(fees.totals.unpaid, cur)}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </Card>
  )
}
