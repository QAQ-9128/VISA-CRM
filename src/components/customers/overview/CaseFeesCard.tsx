import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card } from '../../ui/Card'
import { Select } from '../../ui/Select'
import { TextField } from '../../ui/TextField'
import { Button } from '../../ui/Button'
import { Avatar } from '../../ui/Avatar'
import { ChevronRightIcon, MoreIcon } from '../../ui/icons'
import { getAllPaymentPlans, getAllPayments } from '../../../api/dashboard'
import { getAllPlanItems } from '../../../api/payments'
import { getDocumentSignedUrl } from '../../../api/documents'
import { useDocumentsByCase, useAddDocument, useArchiveDocument } from '../../../hooks/queries/useDocuments'
import { useCustomers } from '../../../hooks/queries/useCustomers'
import { useCaseApplicants } from '../../../hooks/queries/useCaseApplicants'
import { useCreatePayment, useCreatePaymentPlan, useCreatePlanItem, useDeletePayment, useDeletePlanItem, useUpdatePayment, useUpdatePlanItem } from '../../../hooks/queries/usePayments'
import { queryKeys } from '../../../hooks/queries/keys'
import { caseParticipantIds } from '../../../lib/caseGroups'
import { selectCaseFeeGroups } from '../../../lib/caseFees'
import type { CaseFeeGroup, CaseFeeLine } from '../../../lib/caseFees'
import { selectCaseExpenses } from '../../../lib/caseExpenses'
import { itemHasPayments } from '../../../lib/planItems'
import { formatAmount, formatMoney } from '../../../lib/money'
import { RECEIVABLE_STATUS_LABELS, receivableStatusBadgeClass } from '../../../lib/statusColor'
import { useDeferredDelete } from '../../../hooks/useDeferredDelete'
import {
  EXPENSE_DIRECTIONS,
  FEE_CATEGORIES,
  FEE_CATEGORY_OTHER,
  PAYMENT_DIRECTION_LABELS,
  PAYMENT_METHOD_LABELS,
} from '../../../types/domain'
import type { ExpenseDirection, PaymentMethod } from '../../../types/domain'
import type { Case, Customer, Payment } from '../../../types/models'
import { todayYmd } from '../../../lib/dateRules'
import { toastError } from '../../../store/ui'

/** 收款方式（与现有「记收款」一致）。 */
const RECEIPT_METHODS: PaymentMethod[] = ['cash', 'transfer', 'advance']

/** 记一笔支出的「付款对象」：主代理 / 介绍人（单步直记，无应付款项/款项类型）。 */
const EXPENSE_ENTRY_DIRECTIONS: ExpenseDirection[] = ['to_company', 'to_referrer']
/** 支出方式：只用 转账 / 现金 / 垫付。 */
const EXPENSE_METHODS: PaymentMethod[] = ['transfer', 'cash', 'advance']

// 录款默认日期取本地日历日——toISOString 是 UTC 日，本地清晨会落到昨天甚至上个月，污染月度账目
const todayStr = todayYmd
const trimOrNull = (s: string) => (s.trim() === '' ? null : s.trim())

/** 该行（应收款项）对应的真实收款：款项 id 唯一定位（撤销用）。 */
function paymentsForLine(line: CaseFeeLine, casePayments: Payment[]): Payment[] {
  return casePayments.filter((p) => p.plan_item_id === line.planItemId)
}

// ── ⋯ 更多操作菜单（收款行 / 支出行共用同一套交互）─────────────────────
interface MenuItem {
  label: string
  onClick: () => void
  /** 危险项（删除/撤销）→ 珊瑚红字 */
  danger?: boolean
  /** 该项之前插入分隔线 */
  separatorBefore?: boolean
}

function MoreMenu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="grid size-7 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <MoreIcon className="size-[18px]" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 min-w-[140px] overflow-hidden rounded-[12px] border border-line-2 bg-white py-1 shadow-soft"
        >
          {items.map((it) => (
            <Fragment key={it.label}>
              {it.separatorBefore && <div className="my-1 border-t border-line" />}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  it.onClick()
                }}
                className={`block w-full px-3.5 py-2 text-left text-[13px] font-medium transition-colors hover:bg-surface-2 ${it.danger ? 'text-[var(--color-coral)]' : 'text-ink'}`}
              >
                {it.label}
              </button>
            </Fragment>
          ))}
        </div>
      )}
    </div>
  )
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
 * 修改款项（应收条目本身）：改应收金额 / 类别。复用现有 useUpdatePlanItem，
 * 已收 / 未收 / 应收合计照旧从记录重算（派生函数零改动）。改应收不动已记收款。
 */
function EditFeeItemForm({ line, onDone }: { line: CaseFeeLine; onDone: () => void }) {
  const update = useUpdatePlanItem()
  const known = (FEE_CATEGORIES as readonly string[]).includes(line.label)
  const [cat, setCat] = useState<string>(known ? line.label : FEE_CATEGORY_OTHER)
  const [other, setOther] = useState(known ? '' : line.label)
  const [amount, setAmount] = useState(String(line.amount ?? ''))
  const resolved = cat === FEE_CATEGORY_OTHER ? other.trim() : cat
  const canSave = resolved !== '' && amount.trim() !== '' && Number(amount) > 0

  function save(e: FormEvent) {
    e.preventDefault()
    if (!canSave) return
    update.mutate(
      { id: line.planItemId, patch: { fee_category: resolved, amount_due: Number(amount) } },
      { onSuccess: onDone },
    )
  }

  return (
    <form onSubmit={save} className="mt-1 space-y-2 rounded-[12px] border border-brand-100 bg-white p-2.5">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Select
          label="款项类型"
          options={[...FEE_CATEGORIES.map((c) => ({ value: c, label: c })), { value: FEE_CATEGORY_OTHER, label: '其他（手填）' }]}
          value={cat}
          onChange={(e) => setCat(e.target.value)}
        />
        <TextField label="修改金额" required type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      {cat === FEE_CATEGORY_OTHER && (
        <TextField label="其他类型" value={other} onChange={(e) => setOther(e.target.value)} placeholder="如：公证费" />
      )}
      {update.isError && <p className="text-sm text-[var(--color-coral)]">保存失败，请重试。</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={!canSave || update.isPending}>{update.isPending ? '保存中…' : '保存修改'}</Button>
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

/**
 * 修改已记收款（撤销之外的「改」）：改金额 / 实际日期 / 方式。
 * 只动这笔流水记录，复用现有 useUpdatePayment（patch from_client 这笔），
 * 已收 / 未收 / 净额 / 本案合计照旧从记录重算（派生函数零改动）。
 */
function EditReceiptForm({
  caseId,
  payment,
  currency,
  onDone,
}: {
  caseId: string
  payment: Payment
  currency: string
  onDone: () => void
}) {
  const update = useUpdatePayment(caseId)
  const [amount, setAmount] = useState(String(payment.amount ?? ''))
  const [paidAt, setPaidAt] = useState((payment.paid_at ?? '').slice(0, 10))
  const [method, setMethod] = useState<PaymentMethod>((payment.method as PaymentMethod) ?? 'transfer')
  const canSave = amount.trim() !== '' && Number(amount) > 0

  function save(e: FormEvent) {
    e.preventDefault()
    if (!canSave) return
    update.mutate(
      { id: payment.id, patch: { amount: Number(amount), paid_at: paidAt || null, method } },
      { onSuccess: onDone },
    )
  }

  return (
    <form onSubmit={save} className="mt-1 space-y-2 rounded-[12px] border border-brand-100 bg-white p-2.5">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <TextField label={`修改金额（${currency}）`} required type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <TextField label="修改日期" required type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
        <Select
          label="方式" required
          options={RECEIPT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))}
          value={method}
          onChange={(e) => setMethod(e.target.value as PaymentMethod)}
        />
      </div>
      {update.isError && <p className="text-sm text-[var(--color-coral)]">保存失败，请重试。</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={!canSave || update.isPending}>{update.isPending ? '保存中…' : '保存修改'}</Button>
        <Button type="button" variant="ghost" onClick={onDone}>取消</Button>
      </div>
    </form>
  )
}

/**
 * 收款款项行（订金 / 律师费 …）—— 一条横向阅读线：
 *   chevron(展开分期收款明细) · 款项名 · 金额(右对齐等宽) · 状态chip(色取 lib/statusColor) · [记收款?] + ⋯
 * 待付款行额外保留一个主操作「记收款」；已收款行只有 ⋯。改/删/明细全收进 ⋯ 菜单。
 */
function FeeRow({
  line,
  caseId,
  customerId,
  billingApplicantId,
  currency,
  payments,
  onUndo,
  onDeleteItem,
}: {
  line: CaseFeeLine
  caseId: string
  customerId: string
  billingApplicantId: string | null
  currency: string
  payments: Payment[]
  onUndo: (paymentId: string) => void
  /** 删除整条款项（乐观移除 + 延迟落库；有收款则即时错误 toast 拦截） */
  onDeleteItem: (planItemId: string, label: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [openReceipt, setOpenReceipt] = useState(false)
  const [editItem, setEditItem] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const isOwing = line.unpaid > 0
  const isSettled = line.status === 'settled'

  const menuItems: MenuItem[] = [
    { label: '收款明细', onClick: () => setExpanded(true) },
    { label: '修改款项', onClick: () => setEditItem(true) },
    { label: '删除款项', danger: true, separatorBefore: true, onClick: () => onDeleteItem(line.planItemId, line.label) },
  ]

  return (
    <div className="border-b border-line last:border-0">
      <div className="flex items-center gap-2 py-2.5">
        {/* 行首 chevron：展开/收起本款项的分期收款记录 */}
        <button
          type="button"
          aria-label="展开收款明细"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="grid size-5 shrink-0 place-items-center rounded text-faint transition-colors hover:text-ink"
        >
          <ChevronRightIcon className={`size-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>
        <span className="min-w-0 flex-1 truncate text-sm text-ink">{line.label}</span>
        {/* 金额列：右对齐 + 等宽数字（已收=绿 green-d，应收=ink） */}
        <span className={`min-w-[92px] shrink-0 whitespace-nowrap text-right text-sm font-semibold tabular-nums ${isSettled ? 'text-emerald-700' : 'text-ink'}`}>
          {formatMoney(line.amount, currency)}
        </span>
        {/* 状态列：色取 lib/statusColor 单一来源（已收款=绿 / 待付款=蓝） */}
        <span className="flex w-[60px] shrink-0 justify-center">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${receivableStatusBadgeClass(line.status)}`}>
            {RECEIVABLE_STATUS_LABELS[line.status]}
          </span>
        </span>
        {/* 操作列：待付款 → 记收款(绿实心) + ⋯；已收款 → 仅 ⋯ */}
        <div className="flex shrink-0 items-center justify-end gap-1">
          {isOwing && (
            <button
              type="button"
              onClick={() => setOpenReceipt((o) => !o)}
              className="rounded-full bg-brand-700 px-2.5 py-1 text-[12px] font-semibold text-white transition-colors hover:bg-brand-800"
            >
              记收款
            </button>
          )}
          <MoreMenu label="款项操作" items={menuItems} />
        </div>
      </div>

      {/* 修改款项（应收金额 / 类别本身，不动已记收款） */}
      {editItem && <EditFeeItemForm line={line} onDone={() => setEditItem(false)} />}

      {/* 展开：本款项的分期收款记录（每笔 改 / 撤销，复用 useUpdatePayment/useDeletePayment） */}
      {expanded && (
        <div className="mb-2 space-y-1 rounded-[12px] bg-brand-50/50 p-2.5">
          {payments.length === 0 ? (
            <p className="text-[12px] text-faint">暂无收款记录</p>
          ) : (
            payments.map((p) => (
              <div key={p.id}>
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="text-faint tabular-nums">{(p.paid_at ?? '').slice(0, 10)}</span>
                  <span className="flex-1 tabular-nums text-ink">{formatMoney(Number(p.amount), p.currency || currency)}</span>
                  <span className="text-faint">{PAYMENT_METHOD_LABELS[p.method as PaymentMethod] ?? p.method}</span>
                  <button
                    type="button"
                    aria-label="改这笔"
                    aria-expanded={editingId === p.id}
                    onClick={() => setEditingId((id) => (id === p.id ? null : p.id))}
                    className="font-semibold text-brand hover:underline"
                  >
                    改
                  </button>
                  <button
                    type="button"
                    aria-label="撤销这笔"
                    onClick={() => onUndo(p.id)}
                    className="font-semibold text-[var(--color-coral)] hover:underline"
                  >
                    撤销
                  </button>
                </div>
                {editingId === p.id && (
                  <EditReceiptForm caseId={caseId} payment={p} currency={currency} onDone={() => setEditingId(null)} />
                )}
              </div>
            ))
          )}
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

/** 一个参与人分组：浅绿头条(头像 + 姓名) + 款项行 + 小计 strip + 「给 [姓名] 添加款项」幽灵按钮。 */
function FeeGroupBlock({
  group,
  caseId,
  customerId,
  currency,
  casePayments,
  onUndo,
  onDeleteItem,
}: {
  group: CaseFeeGroup
  caseId: string
  customerId: string
  currency: string
  casePayments: Payment[]
  onUndo: (paymentId: string) => void
  onDeleteItem: (planItemId: string, label: string) => void
}) {
  const [adding, setAdding] = useState(false)
  // 组头真折叠：多人案件费用卡很长，可按人收起；默认展开
  const [collapsed, setCollapsed] = useState(false)
  return (
    <div>
      {/* 组头：清新绿浅底条 + 圆形姓名首字头像 + 姓名（标题字）；点击折叠/展开本人款项 */}
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        className="flex w-full items-center gap-2.5 rounded-[12px] bg-brand-50 px-3 py-2 text-left transition-colors hover:bg-brand-100"
      >
        <Avatar name={group.participantName} seed={group.participantId} size={30} />
        <span className="min-w-0 truncate font-serif text-[15px] font-bold text-ink">{group.participantName || '—'}</span>
        {collapsed && group.lines.length > 0 && (
          <span className="shrink-0 text-[11px] font-medium text-muted">
            {group.lines.length} 项 · 未收 {formatMoney(group.unpaid, currency)}
          </span>
        )}
        <ChevronRightIcon className={`ml-auto size-4 shrink-0 text-muted transition-transform ${collapsed ? '' : 'rotate-90'}`} />
      </button>

      {!collapsed && (
        <div className="px-0.5">
          {group.lines.length === 0 ? (
            <p className="py-3 text-center text-sm text-faint">本人暂无费用</p>
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
                onDeleteItem={onDeleteItem}
              />
            ))
          )}
        </div>
      )}

      {/* [姓名] 小计 strip：应收 / 已收 / 未收（from_client 口径）；未收>0 标珊瑚红 */}
      {!collapsed && group.lines.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center justify-end gap-x-4 gap-y-1 rounded-[12px] bg-surface-2 px-3 py-2 text-[12px]">
          <span className="mr-auto font-semibold text-ink">{group.participantName} 小计</span>
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

      {/* 给 [姓名] 添加款项（仅登记应收 → 待付款）；虚线幽灵按钮 */}
      {!collapsed &&
        (adding ? (
          <AddFeeItemForm caseId={caseId} planId={group.planId} billingApplicantId={group.applicantId} onDone={() => setAdding(false)} />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-1.5 flex min-h-9 w-full items-center justify-center gap-1 rounded-[12px] border border-dashed border-brand/45 bg-brand-50/30 text-[12.5px] font-semibold text-brand-700 transition-colors hover:bg-brand-50"
          >
            + 给 {group.participantName} 添加款项
          </button>
        ))}
    </div>
  )
}

/**
 * 记一笔支出（💸 本案支出，**单步直记**）：付款对象（主代理/介绍人）/ 金额 / 实际日期 / 方式 / 备注。
 * 只记实付流水，无「应付款项 / 款项类型」预建步骤；复用现有 useCreatePayment——
 * 案件级支出不挂申请人/款项（applicant_id/plan_item_id = null），不进应收口径。
 * 净额仍按双流重算（付主代理→to_company / 付介绍人→to_referrer）。
 */
function ExpenseForm({ caseId, currency, onDone }: { caseId: string; currency: string; onDone: () => void }) {
  const create = useCreatePayment(caseId)
  const [direction, setDirection] = useState<ExpenseDirection>('to_company')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('transfer')
  const [note, setNote] = useState('')
  const canSave = amount.trim() !== '' && Number(amount) > 0

  function save(e: FormEvent) {
    e.preventDefault()
    if (!canSave) return
    create.mutate(
      {
        case_id: caseId,
        applicant_id: null,
        direction,
        plan_item_id: null,
        amount: Number(amount),
        currency,
        method,
        // 支出不单独录日期：取记账当天（本地澳洲日历日，禁 UTC），月度账目按此归月
        paid_at: todayStr(),
        note: trimOrNull(note),
      },
      { onSuccess: onDone },
    )
  }

  return (
    <form onSubmit={save} className="mt-2 space-y-2.5 rounded-[14px] border border-rose-100 bg-rose-50/40 p-3">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <Select
          label="付款对象" required
          options={EXPENSE_ENTRY_DIRECTIONS.map((d) => ({ value: d, label: PAYMENT_DIRECTION_LABELS[d] }))}
          value={direction}
          onChange={(e) => setDirection(e.target.value as ExpenseDirection)}
        />
        <TextField label={`金额（${currency}）`} required type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Select
          label="方式" required
          options={EXPENSE_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))}
          value={method}
          onChange={(e) => setMethod(e.target.value as PaymentMethod)}
        />
      </div>
      <TextField label="备注（选填）" value={note} onChange={(e) => setNote(e.target.value)} placeholder="如：体检费垫付" />
      {create.isError && <p className="text-sm text-[var(--color-coral)]">保存失败，请重试。</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={!canSave || create.isPending}>{create.isPending ? '保存中…' : '保存支出'}</Button>
        <Button type="button" variant="ghost" onClick={onDone}>取消</Button>
      </div>
    </form>
  )
}

/**
 * 修改已记支出：改金额 / 付款对象（付主代理↔付介绍人；历史垫付杂项也可改）。支出不录日期，故不改日期。
 * 复用现有 useUpdatePayment（patch 这笔支出流水）；支出合计 / 本案净额 / 财务账目照旧从记录重算。
 */
function EditExpenseForm({
  caseId,
  payment,
  currency,
  onDone,
}: {
  caseId: string
  payment: Payment
  currency: string
  onDone: () => void
}) {
  const update = useUpdatePayment(caseId)
  const [direction, setDirection] = useState<ExpenseDirection>(payment.direction as ExpenseDirection)
  const [amount, setAmount] = useState(String(payment.amount ?? ''))
  const canSave = amount.trim() !== '' && Number(amount) > 0

  function save(e: FormEvent) {
    e.preventDefault()
    if (!canSave) return
    update.mutate(
      { id: payment.id, patch: { amount: Number(amount), direction } },
      { onSuccess: onDone },
    )
  }

  return (
    <form onSubmit={save} className="mt-1 space-y-2 rounded-[12px] border border-rose-100 bg-white p-2.5">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Select
          label="付款对象"
          options={EXPENSE_DIRECTIONS.map((d) => ({ value: d, label: PAYMENT_DIRECTION_LABELS[d] }))}
          value={direction}
          onChange={(e) => setDirection(e.target.value as ExpenseDirection)}
        />
        <TextField label={`修改金额（${currency}）`} required type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      {update.isError && <p className="text-sm text-[var(--color-coral)]">保存失败，请重试。</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={!canSave || update.isPending}>{update.isPending ? '保存中…' : '保存修改'}</Button>
        <Button type="button" variant="ghost" onClick={onDone}>取消</Button>
      </div>
    </form>
  )
}

/** 一条支出行：类别标签 + 方式·日期 · 金额(珊瑚红右对齐) · ⋯（修改 / 撤销·删除）。无展开、无状态、无主操作。 */
function ExpenseRow({
  payment,
  caseId,
  currency,
  onUndo,
}: {
  payment: Payment
  caseId: string
  currency: string
  onUndo: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const p = payment
  const methodLabel = PAYMENT_METHOD_LABELS[p.method as PaymentMethod] ?? p.method
  const dateStr = p.paid_at ? p.paid_at.slice(0, 10) : '—'
  const menuItems: MenuItem[] = [
    { label: '修改支出', onClick: () => setEditing(true) },
    { label: '撤销·删除支出', danger: true, separatorBefore: true, onClick: () => onUndo(p.id) },
  ]
  return (
    <li className="border-b border-line pb-1.5 last:border-0">
      <div className="flex items-center gap-2 py-1 text-[12.5px]">
        <span className="shrink-0 rounded-full bg-[var(--color-coral-bg)] px-2 py-0.5 text-[11px] font-semibold text-[#c25a52]">
          {PAYMENT_DIRECTION_LABELS[p.direction]}
        </span>
        <span className="min-w-0 flex-1 truncate" title={p.note ?? undefined}>
          {p.note && <span className="text-ink">{p.note}</span>}
          <span className="text-faint">
            {p.note ? ' · ' : ''}
            {methodLabel} · {dateStr}
          </span>
        </span>
        <span className="min-w-[92px] shrink-0 whitespace-nowrap text-right font-semibold tabular-nums text-[#c25a52]">{formatMoney(Number(p.amount), p.currency || currency)}</span>
        <MoreMenu label="支出操作" items={menuItems} />
      </div>
      {editing && <EditExpenseForm caseId={caseId} payment={p} currency={currency} onDone={() => setEditing(false)} />}
    </li>
  )
}

/**
 * 💸 本案支出：三类实付（付主代理 / 付介绍人 / 垫付杂项）流水 + 分类小计与合计。
 * 与月度/财年账目同口径同源（lib/caseExpenses；写入走 useCreatePayment → dashboard.payments 失效联动）。
 */
function CaseExpensesBlock({
  caseId,
  currency,
  casePayments,
  onUndo,
}: {
  caseId: string
  currency: string
  casePayments: Payment[]
  onUndo: (paymentId: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const expenses = useMemo(() => selectCaseExpenses(casePayments), [casePayments])
  const t = expenses.totals

  return (
    <div className="mt-4 border-t border-line pt-3">
      <h3 className="font-serif text-[14px] font-bold text-ink">
        <span aria-hidden className="mr-1">💸</span>本案支出
      </h3>
      <p className="mt-0.5 text-[11.5px] text-faint">付主代理 / 付介绍人 / 垫付杂项 · 与财务账目联动同源</p>

      {expenses.items.length === 0 ? (
        <p className="mt-2 text-center text-[12.5px] text-faint">本案暂无支出</p>
      ) : (
        <>
          <ul className="mt-2 space-y-1.5">
            {expenses.items.map((p) => (
              <ExpenseRow key={p.id} payment={p} caseId={caseId} currency={currency} onUndo={onUndo} />
            ))}
          </ul>
          {/* 支出合计 strip + 三类小计（与账目支出栏同口径：负数冲红不抵减） */}
          <div className="mt-2.5 flex flex-wrap items-end justify-between gap-2 rounded-[12px] bg-surface-2 px-3 py-2">
            <div>
              <div className="text-[11.5px] text-muted">支出合计</div>
              <div className="font-serif text-[17px] font-bold tabular-nums text-[#c25a52]">{formatMoney(t.total, currency)}</div>
            </div>
            <div className="text-[11.5px] tabular-nums text-faint">
              付主代理 {formatAmount(t.toCompany)} · 付介绍人 {formatAmount(t.toReferrer)} · 垫付杂项 {formatAmount(t.misc)}
            </div>
          </div>
        </>
      )}

      {adding ? (
        <ExpenseForm caseId={caseId} currency={currency} onDone={() => setAdding(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-2.5 flex min-h-10 w-full items-center justify-center gap-1.5 rounded-[12px] border border-dashed border-[#c25a52]/45 bg-rose-50/30 text-[13px] font-semibold text-[#c25a52] transition-colors hover:bg-rose-50"
        >
          + 记支出
        </button>
      )}
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
 * ③ 费用记录卡（本案 · 按人拆分 · 与财务同源）—— 客户应收视图。
 * 分组覆盖**本案全部参与人**（= 案件所属组成员，与案件页顶部「本案参与人」同源）。
 * 每行收敛成一条横向阅读线：款项名 → 金额 → 状态 → 单一操作(⋯ / 记收款)。
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

  // 删除/撤销改为「乐观移除 + 5s 后落库 + 可撤销 toast」（无 window.confirm、零迁移）。
  // pending 的记录 id 从渲染数据里过滤掉 → 应收/已收/未收/合计/净额立即从剩余记录重算。
  const del = useDeletePayment(caseRow?.id ?? '')
  const delItem = useDeletePlanItem()
  const { pendingIds, schedule } = useDeferredDelete(5000)

  // 全量（DB 真相，守卫判定用）与可见（过滤掉 pending，渲染/重算用）
  const allCasePayments = useMemo(
    () => (paymentsQ.data ?? []).filter((p) => p.case_id === (caseRow?.id ?? '')),
    [paymentsQ.data, caseRow?.id],
  )
  const casePayments = useMemo(() => allCasePayments.filter((p) => !pendingIds.has(p.id)), [allCasePayments, pendingIds])
  const visiblePlanItems = useMemo(() => (planItemsQ.data ?? []).filter((i) => !pendingIds.has(i.id)), [planItemsQ.data, pendingIds])

  const fees = useMemo(() => {
    if (!caseRow) return null
    return selectCaseFeeGroups(
      caseRow,
      groupMemberIds,
      plansQ.data ?? [],
      casePayments,
      customerById,
      visiblePlanItems,
    )
  }, [caseRow, groupMemberIds, plansQ.data, casePayments, customerById, visiblePlanItems])

  // 本案净额 = 已收(收款) − 支出合计（含垫付杂项）。两者均复用现有派生（getCaseTotals / selectCaseExpenses）。
  const expenseTotal = useMemo(() => selectCaseExpenses(casePayments).totals.total, [casePayments])

  const handleUndo = (id: string) => {
    schedule(id, () => del.mutate(id), '已撤销一笔收款')
  }
  const handleUndoExpense = (id: string) => {
    const p = allCasePayments.find((x) => x.id === id)
    const label = p ? PAYMENT_DIRECTION_LABELS[p.direction as ExpenseDirection] ?? '支出' : '支出'
    schedule(id, () => del.mutate(id), `已删除「${label}」`)
  }
  const handleDeleteItem = (planItemId: string, label: string) => {
    // 守卫：名下已有收款的款项不可删（与 useDeletePlanItem 守卫同口径）→ 即时错误 toast，不做乐观移除
    if (itemHasPayments(planItemId, allCasePayments)) {
      toastError('该款项已有收款记录，无法删除')
      return
    }
    schedule(planItemId, () => delItem.mutate({ id: planItemId, payments: allCasePayments }), `已删除「${label}」`)
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
  const caseNet = Math.round(((fees?.totals.paid ?? 0) - expenseTotal) * 100) / 100

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
          <div className="space-y-3.5">
            {fees.groups.map((g) => (
              <FeeGroupBlock
                key={g.participantId}
                group={g}
                caseId={caseRow.id}
                customerId={caseRow.customer_id}
                currency={cur}
                casePayments={casePayments}
                onUndo={handleUndo}
                onDeleteItem={handleDeleteItem}
              />
            ))}
          </div>

          {/* 💸 本案支出（三类实付：付主代理/付介绍人/垫付杂项；与财务账目联动同源） */}
          <CaseExpensesBlock
            caseId={caseRow.id}
            currency={cur}
            casePayments={casePayments}
            onUndo={handleUndoExpense}
          />

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

            {/* 本案净额 = 已收 − 支出合计（含垫付杂项），即卡上「已收」减「支出合计」。 */}
            <div className="mt-3 flex flex-wrap items-end justify-between gap-x-3 gap-y-1 border-t border-line pt-2.5">
              <div>
                <div className="text-[11.5px] text-muted">本案净额（收款 − 支出）</div>
                <div className="text-[11px] text-faint tabular-nums">
                  收款 {formatMoney(fees.totals.paid, cur)} − 支出 {formatMoney(expenseTotal, cur)}
                </div>
              </div>
              <div className={`font-serif text-[20px] font-bold tabular-nums ${caseNet >= 0 ? 'text-brand' : 'text-[var(--color-coral)]'}`}>
                {formatMoney(caseNet, cur)}
              </div>
            </div>
            <p className="mt-1 text-[10.5px] text-faint">支出 = 付主代理 + 付介绍人 + 垫付杂项（= 上方「支出合计」）</p>
          </div>
        </>
      )}
    </Card>
  )
}
