import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card } from '../../ui/Card'
import { Select } from '../../ui/Select'
import { TextField } from '../../ui/TextField'
import { Button } from '../../ui/Button'
import { Avatar } from '../../ui/Avatar'
import { useConfirm } from '../../ui/useConfirm'
import { ChevronRightIcon, MoreIcon, EditIcon, XIcon, PlusIcon, WalletIcon, UsersIcon } from '../../ui/icons'
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
import {
  FEE_ENTRY_TYPES,
  FEE_ENTRY_TYPE_LABELS,
  FEE_ENTRY_STATUS,
  draftToPlanItem,
  draftToReceipt,
  emptyDraft,
  validateDrafts,
} from '../../../lib/feeEntry'
import type { DraftFeeLine, FeeEntryType } from '../../../lib/feeEntry'
import { FancySelect, ComboBox, FIELD_CLASS } from '../../ui/FancySelect'
import type { FancyOption } from '../../ui/FancySelect'
import { selectCaseExpenses, selectPendingExpenses } from '../../../lib/caseExpenses'
import {
  EXPENSE_PARTIES,
  EXPENSE_PARTY_LABELS,
  EXPENSE_METHODS,
  actualAmount,
  actualFormula,
  draftToExpensePayment,
  emptyExpenseDraft,
  payableItemToPayment,
  paymentToPayableItem,
  validateExpenseDrafts,
} from '../../../lib/expenseEntry'
import type { DraftExpenseLine, ExpenseParty } from '../../../lib/expenseEntry'
import { itemHasPayments, isPayableItem } from '../../../lib/planItems'
import { formatMoney, formatAmount } from '../../../lib/money'
import {
  RECEIVABLE_STATUS_LABELS,
  receivableStatusBadgeClass,
  EXPENSE_STATUS_LABELS,
  expenseStatusBadgeClass,
} from '../../../lib/statusColor'
import { useDeferredDelete } from '../../../hooks/useDeferredDelete'
import {
  FEE_CATEGORIES,
  FEE_CATEGORY_OTHER,
  PAYMENT_DIRECTION_LABELS,
  PAYMENT_METHOD_LABELS,
} from '../../../types/domain'
import type { PaymentMethod } from '../../../types/domain'
import type { Case, Customer, Payment, PaymentPlanItem } from '../../../types/models'
import { todayYmd } from '../../../lib/dateRules'
import { toastError } from '../../../store/ui'

/** 收款方式（与现有「记收款」一致）。 */
const RECEIPT_METHODS: PaymentMethod[] = ['cash', 'transfer', 'advance']

// 录款默认日期取本地日历日——toISOString 是 UTC 日，本地清晨会落到昨天甚至上个月，污染月度账目
const todayStr = todayYmd
const trimOrNull = (s: string) => (s.trim() === '' ? null : s.trim())

// ── 行版式：自适应换行 flex（身份段「名目/付款对象」+ 数字段「金额·徽章·操作」）。───────────
// ★为什么不用固定网格/单行 flex：窄卡片里 chip(不可压) + 金额 + 徽章 + 操作钮 一行放不下——
//   网格里 chip 会溢出压到金额上；单行 flex 则名目被挤没、内容横向溢出（实测 343px 卡片 OVERFLOW）。
// ★这里用 flex-wrap **按容器宽度**(非视口断点)自适应：宽时一行排开；窄到放不下时「数字段」整体
//   换到第二行(ml-auto 靠右)，第一行让「身份段」完整显示。两段都不收缩内部关键信息 → 不溢出、不重叠、
//   金额永不被截断；几个字段在任意宽度都平衡展示。
const ROW_WRAP = 'fee-row flex flex-wrap items-center gap-x-2.5 gap-y-1.5 px-3.5 py-2.5'
/** 身份段：名目/付款对象。grow 占满本行剩余宽；min-w-0 让过长名目截断而非撑破。 */
const ROW_IDENTITY = 'flex min-w-0 grow items-center gap-2'
/** 数字+操作段：金额·徽章·操作。shrink-0 整体不压；ml-auto 靠右；放不下时整段换行。 */
const ROW_FIGURES = 'flex shrink-0 items-center gap-2.5 ml-auto'
/** 行尾操作区：固定占位（透明/可点由 CSS 控）。所有按钮恒在 DOM，只切 opacity → 不挤动金额/徽章。 */
const ROW_ACTIONS = 'fee-row-actions flex shrink-0 items-center justify-end gap-1.5'

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
  /** 仅窄屏出现（桌面已有对应的行内主操作/编辑钮，菜单里隐去免重复；触屏靠它兜底）。 */
  mobileOnly?: boolean
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
        className="grid size-7 place-items-center rounded-full border border-line-2 bg-white text-muted transition-colors hover:border-faint hover:text-ink"
      >
        <MoreIcon className="size-[18px]" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 min-w-[148px] overflow-hidden rounded-[12px] border border-line-2 bg-white py-1 shadow-soft"
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
                className={`block w-full px-3.5 py-2 text-left text-[13px] font-medium transition-colors hover:bg-surface-2 ${it.mobileOnly ? 'sm:hidden' : ''} ${it.danger ? 'text-[var(--color-coral)]' : 'text-ink'}`}
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

/** 行内编辑（铅笔）小图钮：桌面悬停出现；窄屏隐藏（编辑收进 ⋯ 菜单），让出宽度给名目。 */
function EditIconButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="hidden size-7 shrink-0 place-items-center rounded-full border border-line-2 bg-white text-muted transition-colors hover:border-faint hover:text-ink sm:grid"
    >
      <EditIcon className="size-[15px]" />
    </button>
  )
}

/** 行内主操作实心钮（记收款=绿 / 记支出=珊瑚）。桌面悬停出现；窄屏隐藏（主操作收进 ⋯ 菜单）。 */
function RowPrimaryButton({ label, tone, onClick }: { label: string; tone: 'green' | 'coral'; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`hidden shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold text-white transition-colors sm:inline-flex ${tone === 'green' ? 'bg-brand-700 hover:bg-brand-800' : 'bg-[#c25a52] hover:bg-[#b14e47]'}`}
    >
      {label}
    </button>
  )
}

/** 类型下拉两项：收款(绿 tag) / 待付(黄 tag)，色取 lib/statusColor 单一来源。 */
const TYPE_OPTIONS: FancyOption[] = FEE_ENTRY_TYPES.map((t) => ({
  value: t,
  label: FEE_ENTRY_TYPE_LABELS[t],
  tag: (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${receivableStatusBadgeClass(FEE_ENTRY_STATUS[t])}`}>
      {FEE_ENTRY_TYPE_LABELS[t]}
    </span>
  ),
}))

/**
 * 列式录入（收款侧）—— 一行一笔，列 = 类型 / 描述 / 金额。
 *   - 类型：收款（绿·全额记一笔 from_client 收款=已收）/ 待付（黄·仅建应收款项）。
 *   - 描述：ComboBox 可选「律师费 / 文案费」亦可**手填任意文字**（手填能力保留）。
 *   - 响应式：窄屏字段纵向堆叠、永不横向滚动；宽屏一行横排。控件共用 FIELD_CLASS（同高/圆角/边/底/focus）。
 *   - 默认收起：由父组件控制；保存/取消即收。空白行忽略、半填行拦截、金额>0。
 * 账目算法零改动：保存只是「建款项(+收款类补一笔全额收款)」，应收/已收/未收照旧从记录派生。
 */
function FeeLinesEditor({
  caseId,
  planId,
  billingApplicantId,
  currency,
  shared = false,
  onDone,
}: {
  caseId: string
  planId: string | null
  billingApplicantId: string | null
  currency: string
  /** 共享·全案组：录入的款项/收款打 is_shared=true、不归任何 applicant。 */
  shared?: boolean
  /** 保存成功 / 取消 → 收起列式录入（回到查看态） */
  onDone: () => void
}) {
  const createPlan = useCreatePaymentPlan(caseId)
  const createItem = useCreatePlanItem()
  const createPayment = useCreatePayment(caseId)
  const [rows, setRows] = useState<DraftFeeLine[]>(() => [emptyDraft()])
  const [error, setError] = useState<string | null>(null)

  const pending = createPlan.isPending || createItem.isPending || createPayment.isPending
  const { ready, ok } = validateDrafts(rows)

  const patchRow = (key: string, patch: Partial<DraftFeeLine>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  const addRow = () => setRows((rs) => [...rs, emptyDraft()])
  const removeRow = (key: string) =>
    setRows((rs) => {
      const next = rs.filter((r) => r.key !== key)
      return next.length ? next : [emptyDraft()]
    })

  async function save(e: FormEvent) {
    e.preventDefault()
    const v = validateDrafts(rows)
    if (!v.ok) {
      setError(v.error)
      return
    }
    setError(null)
    let pid = planId
    if (!pid) {
      // 共享组懒建计划：applicant_id=null（款项/收款靠 is_shared 归入共享组，与主申合并账互不干扰）
      const plan = await createPlan.mutateAsync({ case_id: caseId, applicant_id: shared ? null : billingApplicantId })
      pid = plan.id
    }
    const paidAt = todayStr()
    for (const d of v.ready) {
      const item = await createItem.mutateAsync(draftToPlanItem(d, pid, shared))
      const receipt = draftToReceipt(d, {
        caseId,
        applicantId: billingApplicantId,
        planItemId: item.id,
        currency,
        paidAt,
        shared,
      })
      if (receipt) await createPayment.mutateAsync(receipt)
    }
    onDone() // 保存成功 → 收起
  }

  return (
    <form onSubmit={save} className="border-t border-line bg-brand-50/20 px-3.5 py-3">
      <div className="space-y-2.5">
        {rows.map((row) => (
          // 窄屏：字段 w-full 逐行堆叠（flex-wrap 永不横向滚动）；宽屏：一行横排。
          <div key={row.key} className="flex flex-wrap items-center gap-2 border-b border-line/60 pb-2.5 last:border-0 last:pb-0">
            {/* 类型：21st 风 FancySelect（收款绿/待付黄 tag + 动画勾选 + portal） */}
            <div className="w-full sm:w-[104px]">
              <FancySelect
                ariaLabel="录入类型"
                value={row.type}
                onChange={(v) => patchRow(row.key, { type: v as FeeEntryType | '' })}
                options={TYPE_OPTIONS}
                placeholder="类型"
              />
            </div>
            {/* 描述：ComboBox（可选 律师费/文案费，亦可手填任意文字——手填能力保留） */}
            <ComboBox
              ariaLabel="录入描述"
              value={row.desc}
              onChange={(v) => patchRow(row.key, { desc: v })}
              options={[...FEE_CATEGORIES]}
              placeholder="描述（可选 / 手填）"
              className="w-full sm:min-w-[120px] sm:flex-1"
            />
            {/* 金额 + ✕：窄屏同一行（金额撑满 + ✕ 收尾），宽屏金额定宽 */}
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <input
                aria-label="款额"
                type="number"
                min={0}
                step="0.01"
                value={row.amount}
                onChange={(e) => patchRow(row.key, { amount: e.target.value })}
                placeholder="金额（AUD）"
                className={`${FIELD_CLASS} min-w-0 flex-1 px-3 text-right tabular-nums placeholder:text-faint sm:w-[120px] sm:flex-none`}
              />
              <button
                type="button"
                aria-label="删除该行"
                onClick={() => removeRow(row.key)}
                className="grid size-7 shrink-0 place-items-center rounded-full text-faint transition-colors hover:text-[var(--color-coral)]"
              >
                <XIcon className="size-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {error && <p className="mt-2 text-[12px] text-[var(--color-coral)]">{error}</p>}

      <div className="mt-2.5 flex items-center gap-3">
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-700 transition-colors hover:text-brand-800"
        >
          <PlusIcon className="size-4" />
          再加一行
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={onDone} className="text-[13px] font-medium text-muted transition-colors hover:text-ink">
            取消
          </button>
          {ok && (
            <Button type="submit" disabled={pending}>
              {pending ? '保存中…' : `保存${ready.length > 1 ? ` ${ready.length} 项` : ''}`}
            </Button>
          )}
        </div>
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
    <form onSubmit={save} className="border-t border-line bg-brand-50/20 px-3.5 py-3">
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
        <TextField label="其他类型" value={other} onChange={(e) => setOther(e.target.value)} placeholder="如：公证费" className="mt-2" />
      )}
      {update.isError && <p className="mt-1 text-sm text-[var(--color-coral)]">保存失败，请重试。</p>}
      <div className="mt-2 flex gap-2">
        <Button type="submit" disabled={!canSave || update.isPending}>{update.isPending ? '保存中…' : '保存修改'}</Button>
        <Button type="button" variant="ghost" onClick={onDone}>取消</Button>
      </div>
    </form>
  )
}

/**
 * 记收款（待付款 → 已收款）：金额(默认未收，可改) / 实际日期(默认今天) / 方式 /
 * 上传发票(选填 → 本案 documents invoice) / 备注。复用 useCreatePayment（from_client），状态自动翻「已收款」。
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
          if (file) addDoc.mutate({ file, customer_id: customerId, case_id: caseId, doc_type: 'invoice' })
          onDone()
        },
      },
    )
  }

  return (
    <form onSubmit={save} className="border-t border-line bg-brand-50/30 px-3.5 py-3">
      <p className="mb-2 text-[13px] font-semibold text-ink">记收款 · {line.label}</p>
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
      <TextField label="备注（选填）" value={note} onChange={(e) => setNote(e.target.value)} className="mt-2.5" />
      <div className="mt-2.5 flex items-center gap-2 text-[13px]">
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
      {create.isError && <p className="mt-1 text-sm text-[var(--color-coral)]">保存失败，请重试。</p>}
      <div className="mt-2.5 flex gap-2">
        <Button type="submit" disabled={!canSave || pending}>{pending ? '保存中…' : '确认收款'}</Button>
        <Button type="button" variant="ghost" onClick={onDone}>取消</Button>
      </div>
    </form>
  )
}

/**
 * 修改已记收款：改金额 / 实际日期 / 方式。复用 useUpdatePayment（patch from_client 这笔），
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
    <form onSubmit={save} className="mt-1.5 space-y-2 rounded-[12px] border border-brand-100 bg-white p-2.5">
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
 * 收款款项行（订金 / 律师费 …）—— 静止态只剩「名目 · 金额 · 状态」，操作悬停才淡入（任务 §3）。
 *   待付款 → 记收款(主) + 编辑 + ⋯(收款明细/删除)；已收款 → 编辑 + ⋯(收款明细/改回待付/删除)。
 *   收款明细（逐笔改/撤销）收进 ⋯ 菜单展开，不再占行首 chevron。
 */
function FeeRow({
  line,
  caseId,
  customerId,
  billingApplicantId,
  currency,
  shared = false,
  payments,
  onUndo,
  onDeleteItem,
}: {
  line: CaseFeeLine
  caseId: string
  customerId: string
  billingApplicantId: string | null
  currency: string
  /** 共享·全案组的行：名目前加「共享」小标签。 */
  shared?: boolean
  payments: Payment[]
  onUndo: (paymentId: string) => void
  onDeleteItem: (planItemId: string, label: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [openReceipt, setOpenReceipt] = useState(false)
  const [editItem, setEditItem] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const { confirm, confirmNode } = useConfirm()
  const isOwing = line.unpaid > 0
  const isSettled = line.status === 'settled'

  // 已收 → 改回待付：撤销该款项名下所有收款（填错救济），需二次确认；走现有撤销(deferred delete)，归账不变
  const revertToOwing = async () => {
    if (payments.length === 0) return
    const okToRevert = await confirm({
      title: '改回待付',
      description: `撤销「${line.label}」名下 ${payments.length} 笔收款、改回待付？金额归账不变，仅状态回退。`,
      confirmLabel: '改回待付',
      tone: 'danger',
    })
    if (okToRevert) payments.forEach((p) => onUndo(p.id))
  }

  const menuItems: MenuItem[] = [
    // 窄屏兜底：桌面用行内「记收款」实心钮，窄屏收进菜单首项
    ...(isOwing ? [{ label: '记收款', mobileOnly: true, onClick: () => setOpenReceipt(true) }] : []),
    { label: '收款明细', onClick: () => setExpanded((v) => !v) },
    { label: '修改款项', onClick: () => setEditItem(true) },
    ...(isSettled
      ? [{ label: '改回待付（撤销收款）', danger: true, separatorBefore: true, onClick: () => void revertToOwing() }]
      : []),
    { label: '删除款项', danger: true, separatorBefore: !isSettled, onClick: () => onDeleteItem(line.planItemId, line.label) },
  ]

  return (
    <div className="border-b border-line last:border-b-0">
      <div className={ROW_WRAP}>
        {/* 身份段：名目（静止态唯一可见的主信息）。窄屏独占首行、完整可读；共享行前加「共享」小标签 */}
        <div className={ROW_IDENTITY}>
          {shared && (
            <span className="shrink-0 rounded-[6px] bg-brand-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-brand-700">共享</span>
          )}
          <span className="min-w-0 truncate text-[14px] text-ink">{line.label}</span>
        </div>
        {/* 数字+操作段：金额 / 徽章 / 操作。放不下时整段换到第二行靠右 */}
        <div className={ROW_FIGURES}>
          {/* 金额：等宽数字（已收=绿，应收=ink），永不截断/换行 */}
          <span className={`shrink-0 whitespace-nowrap text-[14.5px] font-bold tabular-nums ${isSettled ? 'text-emerald-700' : 'text-ink'}`}>
            {formatMoney(line.amount, currency)}
          </span>
          {/* 状态徽章：色取 lib/statusColor 单一来源 */}
          <span className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${receivableStatusBadgeClass(line.status)}`}>
            {RECEIVABLE_STATUS_LABELS[line.status]}
          </span>
          {/* 操作：悬停淡入（固定占位）。待付款 → 记收款 + 编辑 + ⋯；已收款 → 编辑 + ⋯ */}
          <div className={ROW_ACTIONS}>
            {isOwing && <RowPrimaryButton label="记收款" tone="green" onClick={() => setOpenReceipt((o) => !o)} />}
            <EditIconButton label="编辑款项" onClick={() => setEditItem(true)} />
            <MoreMenu label="款项操作" items={menuItems} />
          </div>
        </div>
      </div>

      {/* 修改款项（应收金额 / 类别本身，不动已记收款） */}
      {editItem && <EditFeeItemForm line={line} onDone={() => setEditItem(false)} />}

      {/* 收款明细（⋯ → 收款明细 展开）：本款项的逐笔收款，每笔 改 / 撤销 */}
      {expanded && (
        <div className="space-y-1 border-t border-line bg-brand-50/30 px-3.5 py-2.5">
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
      {confirmNode}
    </div>
  )
}

/** 小计 strip 单项：标签 + 数值（同源 formatAmount 裸数）。 */
function SubItem({ label, value, tone }: { label: string; value: number; tone?: 'green' | 'coral' | 'amber' }) {
  const color =
    tone === 'green' ? 'text-brand-700' : tone === 'coral' ? 'text-[#c25a52]' : tone === 'amber' ? 'text-[#c08a2e]' : 'text-ink'
  return (
    <span className="text-muted">
      {label} <b className={`font-semibold tabular-nums ${value > 0 || tone == null ? color : 'text-faint'}`}>{formatAmount(value)}</b>
    </span>
  )
}

/** 一个客户分组：单层卡（头像 + 名 + 折叠）→ 只读行 + 列式录入 + 底部「添加款项」+ 小计。 */
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
  const [collapsed, setCollapsed] = useState(false)
  const [adding, setAdding] = useState(false)
  const shared = group.shared
  return (
    <div className="rounded-[var(--radius-ctl)] border border-line-2 bg-white">
      {/* 组头：客户组=头像+姓名；共享·全案组=people 图标 + 「属于整个案件·不分个人」小字。 */}
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        className="flex w-full items-center gap-2.5 rounded-t-[var(--radius-ctl)] px-3.5 py-2.5 text-left transition-colors hover:bg-surface-2/60"
      >
        {shared ? (
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
            <UsersIcon className="size-[17px]" />
          </span>
        ) : (
          <Avatar name={group.participantName} seed={group.participantId} size={28} />
        )}
        <span className="min-w-0">
          <span className="block truncate text-[14.5px] font-semibold text-ink">{group.participantName || '—'}</span>
          {shared && <span className="block text-[11px] font-medium text-faint">属于整个案件 · 不分个人</span>}
        </span>
        {group.paid > 0 && (
          <span className="ml-auto shrink-0 text-[12px] font-medium text-faint tabular-nums">已收 {formatAmount(group.paid)}</span>
        )}
        <ChevronRightIcon className={`${group.paid > 0 ? 'ml-1.5' : 'ml-auto'} size-4 shrink-0 text-faint transition-transform ${collapsed ? '' : 'rotate-90'}`} />
      </button>

      {!collapsed && (
        <>
          {group.lines.length > 0 && (
            <div className="border-t border-line">
              {group.lines.map((line) => (
                <FeeRow
                  key={`r-${line.planItemId}`}
                  line={line}
                  caseId={caseId}
                  customerId={customerId}
                  billingApplicantId={group.applicantId}
                  currency={currency}
                  shared={shared}
                  payments={paymentsForLine(line, casePayments)}
                  onUndo={onUndo}
                  onDeleteItem={onDeleteItem}
                />
              ))}
            </div>
          )}

          {/* 列式录入：点「添加款项」才展开；保存/取消即收（共享组录入 is_shared=true） */}
          {adding && (
            <FeeLinesEditor
              caseId={caseId}
              planId={group.planId}
              billingApplicantId={group.applicantId}
              currency={currency}
              shared={shared}
              onDone={() => setAdding(false)}
            />
          )}

          {/* 底栏：添加款项 + 小计（应收 / 已收 / 未收） */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 rounded-b-[var(--radius-ctl)] border-t border-line bg-surface-2/30 px-3.5 py-2.5">
            {!adding ? (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-700 transition-colors hover:text-brand-800"
              >
                <PlusIcon className="size-4" />
                添加款项
              </button>
            ) : (
              <span className="text-[12px] text-faint">录入中…</span>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
              <SubItem label="应收" value={group.receivable} />
              <span className="text-faint">·</span>
              <SubItem label="已收" value={group.paid} tone="green" />
              <span className="text-faint">·</span>
              <SubItem label="未收" value={group.unpaid} tone="coral" />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── 支出侧（21st FancySelect 选项）──────────────────────────
/** 付款对象两项：付给公司(to_company) / 付给介绍人(to_referrer)，珊瑚红 tag。 */
const PARTY_OPTIONS: FancyOption[] = EXPENSE_PARTIES.map((p) => ({
  value: p,
  label: EXPENSE_PARTY_LABELS[p],
  tag: (
    <span className="rounded-full bg-[var(--color-coral-bg)] px-2 py-0.5 text-[11px] font-semibold text-[#c25a52]">
      {EXPENSE_PARTY_LABELS[p]}
    </span>
  ),
}))
const METHOD_OPTIONS: FancyOption[] = EXPENSE_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))

/**
 * 支出列式录入（与收款同款）：一行一笔，列 = 付款对象 / 方式 / 金额 / 百分比 / 实付。
 * ★实付 = 金额 × 百分比（留空=100%），入账的是实付★。新增行 = **实际支出**（payments，计入净额，口径不变）。
 * 响应式：窄屏字段纵堆、实付作底部结果行强调；永不横向滚动。已去「描述」列（2026-06-29 定）。
 */
function ExpenseLinesEditor({ caseId, currency, onDone }: { caseId: string; currency: string; onDone: () => void }) {
  const createPayment = useCreatePayment(caseId)
  const [rows, setRows] = useState<DraftExpenseLine[]>(() => [emptyExpenseDraft()])
  const [error, setError] = useState<string | null>(null)

  const { ready, ok } = validateExpenseDrafts(rows)
  const pending = createPayment.isPending

  const patchRow = (key: string, patch: Partial<DraftExpenseLine>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  const addRow = () => setRows((rs) => [...rs, emptyExpenseDraft()])
  const removeRow = (key: string) =>
    setRows((rs) => {
      const next = rs.filter((r) => r.key !== key)
      return next.length ? next : [emptyExpenseDraft()]
    })

  async function save(e: FormEvent) {
    e.preventDefault()
    const v = validateExpenseDrafts(rows)
    if (!v.ok) {
      setError(v.error)
      return
    }
    setError(null)
    const paidAt = todayStr()
    for (const d of v.ready) {
      await createPayment.mutateAsync(draftToExpensePayment(d, { caseId, currency, paidAt }))
    }
    onDone() // 保存成功 → 收起
  }

  return (
    <form onSubmit={save} className="border-t border-line bg-[var(--color-coral-bg)]/25 px-3.5 py-3">
      <div className="space-y-2.5">
        {rows.map((row) => {
          const actual = actualAmount(row.amount, row.percent)
          return (
            <div key={row.key} className="flex flex-wrap items-center gap-2 border-b border-line/60 pb-2.5 last:border-0 last:pb-0">
              <div className="w-full sm:w-[132px]">
                <FancySelect
                  ariaLabel="付款对象"
                  value={row.party}
                  onChange={(v) => patchRow(row.key, { party: v as ExpenseParty | '' })}
                  options={PARTY_OPTIONS}
                  placeholder="付款对象"
                />
              </div>
              <div className="w-full sm:w-[100px]">
                <FancySelect
                  ariaLabel="支出方式"
                  value={row.method}
                  onChange={(v) => patchRow(row.key, { method: v as PaymentMethod | '' })}
                  options={METHOD_OPTIONS}
                  placeholder="方式"
                />
              </div>
              {/* 金额 × 百分比（窄屏同一行排布；× 提示符号纯展示） */}
              <div className="flex w-full items-center gap-1.5 sm:w-auto">
                <input
                  aria-label="支出金额"
                  type="number"
                  min={0}
                  step="0.01"
                  value={row.amount}
                  onChange={(e) => patchRow(row.key, { amount: e.target.value })}
                  placeholder="金额"
                  className={`${FIELD_CLASS} min-w-0 flex-1 px-2.5 text-right tabular-nums placeholder:text-faint sm:w-[96px] sm:flex-none`}
                />
                <span className="shrink-0 text-[12px] text-faint">×</span>
                <input
                  aria-label="支出百分比"
                  type="number"
                  min={0}
                  max={100}
                  step="1"
                  value={row.percent}
                  onChange={(e) => patchRow(row.key, { percent: e.target.value })}
                  placeholder="留空 = 100%"
                  className={`${FIELD_CLASS} min-w-0 flex-1 px-2.5 text-right tabular-nums placeholder:text-faint sm:w-[104px] sm:flex-none`}
                />
              </div>
              {/* 实付：金额×百分比 自动算（窄屏作底部结果行强调，宽屏靠右） */}
              <div className="flex w-full items-center justify-between gap-2 sm:ml-auto sm:w-auto sm:justify-end">
                <span className="text-[11.5px] font-medium text-muted sm:hidden">实付（{currency}）</span>
                <div className="text-right">
                  <span className={`text-[14px] font-bold tabular-nums ${actual > 0 ? 'text-[#c25a52]' : 'text-faint'}`}>{actual.toFixed(2)}</span>
                  {row.amount.trim() !== '' && row.percent.trim() !== '' && (
                    <span className="ml-1.5 text-[10.5px] tabular-nums text-faint">{actualFormula(row.amount, row.percent)}</span>
                  )}
                </div>
                <button
                  type="button"
                  aria-label="删除该行"
                  onClick={() => removeRow(row.key)}
                  className="grid size-7 shrink-0 place-items-center rounded-full text-faint transition-colors hover:text-[var(--color-coral)]"
                >
                  <XIcon className="size-4" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {error && <p className="mt-2 text-[12px] text-[var(--color-coral)]">{error}</p>}

      <div className="mt-2.5 flex items-center gap-3">
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#c25a52] transition-colors hover:text-[#b14e47]"
        >
          <PlusIcon className="size-4" />
          再加一笔
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={onDone} className="text-[13px] font-medium text-muted transition-colors hover:text-ink">
            取消
          </button>
          {ok && (
            <Button type="submit" disabled={pending}>
              {pending ? '保存中…' : `保存${ready.length > 1 ? ` ${ready.length} 笔` : ''}`}
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}

/** 修改已记支出（已支出）：付款对象 / 方式 / 实付金额。复用 useUpdatePayment（patch 这笔）。 */
function EditExpenseForm({
  caseId,
  payment,
  onDone,
}: {
  caseId: string
  payment: Payment
  onDone: () => void
}) {
  const update = useUpdatePayment(caseId)
  const [party, setParty] = useState<ExpenseParty | ''>(payment.direction as ExpenseParty)
  const [method, setMethod] = useState<PaymentMethod | ''>(payment.method as PaymentMethod)
  const [amount, setAmount] = useState(String(payment.amount ?? ''))
  const canSave = amount.trim() !== '' && Number(amount) > 0 && party !== ''

  function save(e: FormEvent) {
    e.preventDefault()
    if (!canSave) return
    update.mutate(
      { id: payment.id, patch: { amount: Number(amount), direction: party as ExpenseParty, method: (method || 'transfer') as PaymentMethod } },
      { onSuccess: onDone },
    )
  }

  return (
    <form onSubmit={save} className="border-t border-line bg-[var(--color-coral-bg)]/30 px-3.5 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-[132px]">
          <FancySelect ariaLabel="修改付款对象" value={party} onChange={(v) => setParty(v as ExpenseParty | '')} options={PARTY_OPTIONS} placeholder="付款对象" />
        </div>
        <div className="w-full sm:w-[104px]">
          <FancySelect ariaLabel="修改方式" value={method} onChange={(v) => setMethod(v as PaymentMethod | '')} options={METHOD_OPTIONS} placeholder="方式" />
        </div>
        <input
          aria-label="修改实付金额"
          type="number"
          min={0}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={`${FIELD_CLASS} w-full px-3 text-right tabular-nums sm:w-[120px]`}
        />
      </div>
      {update.isError && <p className="mt-1 w-full text-sm text-[var(--color-coral)]">保存失败，请重试。</p>}
      <div className="mt-2.5 flex gap-2">
        <Button type="submit" disabled={!canSave || update.isPending}>{update.isPending ? '保存中…' : '保存修改'}</Button>
        <Button type="button" variant="ghost" onClick={onDone}>取消</Button>
      </div>
    </form>
  )
}

/** 已支出只读行：付款对象 chip + 方式·日期 + 实付(珊瑚) + 已支出徽章 + 悬停(编辑 / ⋯ 撤销·删除)。 */
function PaidExpenseRow({
  payment,
  caseId,
  currency,
  onUndo,
  onToPending,
}: {
  payment: Payment
  caseId: string
  currency: string
  onUndo: (id: string) => void
  onToPending: (payment: Payment) => void
}) {
  const [editing, setEditing] = useState(false)
  const { confirm, confirmNode } = useConfirm()
  const p = payment
  const partyLabel = EXPENSE_PARTY_LABELS[p.direction as ExpenseParty] ?? PAYMENT_DIRECTION_LABELS[p.direction]
  const methodLabel = PAYMENT_METHOD_LABELS[p.method as PaymentMethod] ?? p.method
  const dateStr = p.paid_at ? p.paid_at.slice(5, 10) : '—'

  const revert = async () => {
    const okToRevert = await confirm({
      title: '撤销（改回待支出）',
      description: `把「${partyLabel} ${formatMoney(Number(p.amount), currency)}」撤回为待支出？将从净额中撤出，记支出后再计入。`,
      confirmLabel: '撤销',
      tone: 'danger',
    })
    if (okToRevert) onToPending(p)
  }

  const menuItems: MenuItem[] = [
    // 窄屏兜底：桌面用行内编辑钮，窄屏收进菜单
    { label: '修改支出', mobileOnly: true, onClick: () => setEditing(true) },
    { label: '撤销（改回待支出）', danger: true, onClick: () => void revert() },
    { label: '删除支出', danger: true, separatorBefore: true, onClick: () => onUndo(p.id) },
  ]

  return (
    <div className="border-b border-line last:border-b-0">
      <div className={ROW_WRAP}>
        {/* 身份段：付款对象 chip(整显不压) + 方式·日期(可截断)。窄屏独占首行 */}
        <div className={ROW_IDENTITY}>
          <span className="shrink-0 rounded-full bg-[var(--color-coral-bg)] px-2 py-0.5 text-[11px] font-semibold text-[#c25a52]">{partyLabel}</span>
          <span className="min-w-0 truncate text-[12.5px] text-muted">{methodLabel} · {dateStr}</span>
        </div>
        {/* 数字+操作段：金额 / 徽章 / 操作。放不下时整段换到第二行靠右 */}
        <div className={ROW_FIGURES}>
          <span className="shrink-0 whitespace-nowrap text-[14.5px] font-bold tabular-nums text-[#c25a52]">{formatMoney(Number(p.amount), p.currency || currency)}</span>
          <span className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${expenseStatusBadgeClass('paid')}`}>
            {EXPENSE_STATUS_LABELS.paid}
          </span>
          <div className={ROW_ACTIONS}>
            <EditIconButton label="编辑支出" onClick={() => setEditing(true)} />
            <MoreMenu label="支出操作" items={menuItems} />
          </div>
        </div>
      </div>
      {editing && <EditExpenseForm caseId={caseId} payment={p} onDone={() => setEditing(false)} />}
      {confirmNode}
    </div>
  )
}

/** 待支出只读行：付款对象 chip + 名目 + 待支出额(琥珀) + 待支出徽章 + 悬停(记支出主 / ⋯ 删除)。 */
function PendingExpenseRow({
  item,
  currency,
  onRecord,
  onDelete,
}: {
  item: PaymentPlanItem
  currency: string
  onRecord: (item: PaymentPlanItem) => void
  onDelete: (id: string, label: string) => void
}) {
  const partyLabel = EXPENSE_PARTY_LABELS[(item.expense_direction ?? 'to_company') as ExpenseParty]
  const menuItems: MenuItem[] = [
    // 窄屏兜底：桌面用行内「记支出」实心钮，窄屏收进菜单首项
    { label: '记支出', mobileOnly: true, onClick: () => onRecord(item) },
    { label: '删除待支出', danger: true, onClick: () => onDelete(item.id, item.fee_category) },
  ]
  return (
    <div className="border-b border-line last:border-b-0">
      <div className={ROW_WRAP}>
        {/* 身份段：付款对象 chip(整显不压) + 名目(可截断)。窄屏独占首行 */}
        <div className={ROW_IDENTITY}>
          <span className="shrink-0 rounded-full bg-[#f9f1df] px-2 py-0.5 text-[11px] font-semibold text-[#c08a2e]">{partyLabel}</span>
          <span className="min-w-0 truncate text-[12.5px] text-muted" title={item.fee_category}>{item.fee_category}</span>
        </div>
        {/* 数字+操作段：金额 / 徽章 / 操作。放不下时整段换到第二行靠右 */}
        <div className={ROW_FIGURES}>
          <span className="shrink-0 whitespace-nowrap text-[14.5px] font-bold tabular-nums text-[#c25a52]">{formatMoney(Number(item.amount_due), currency)}</span>
          <span className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${expenseStatusBadgeClass('pending')}`}>
            {EXPENSE_STATUS_LABELS.pending}
          </span>
          <div className={ROW_ACTIONS}>
            <RowPrimaryButton label="记支出" tone="coral" onClick={() => onRecord(item)} />
            <MoreMenu label="待支出操作" items={menuItems} />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * 本案支出（单层卡 · 收支对称两态）：待支出行(payable) + 已支出行(payments) + 列式录入 + 已支出/待支出小计。
 * ★只有已支出（实际 payments）计入净额★（selectCaseExpenses，口径不变）；待支出(payable)只展示、记支出后才转已支出。
 */
function CaseExpensesBlock({
  caseId,
  currency,
  casePayments,
  casePayableItems,
  onUndo,
  onRecordPending,
  onToPending,
  onDeletePayable,
}: {
  caseId: string
  currency: string
  casePayments: Payment[]
  casePayableItems: PaymentPlanItem[]
  onUndo: (paymentId: string) => void
  onRecordPending: (item: PaymentPlanItem) => void
  onToPending: (payment: Payment) => void
  onDeletePayable: (id: string, label: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const paid = useMemo(() => selectCaseExpenses(casePayments), [casePayments])
  const pending = useMemo(() => selectPendingExpenses(casePayableItems), [casePayableItems])
  const hasAny = paid.items.length > 0 || pending.items.length > 0

  return (
    <section className="mt-6">
      <SectionHeader title="支出" />
      <div className="rounded-[var(--radius-ctl)] border border-line-2 bg-white">
        {hasAny && (
          <div>
            {pending.items.map((it) => (
              <PendingExpenseRow key={`pe-${it.id}`} item={it} currency={currency} onRecord={onRecordPending} onDelete={onDeletePayable} />
            ))}
            {paid.items.map((p) => (
              <PaidExpenseRow key={p.id} payment={p} caseId={caseId} currency={currency} onUndo={onUndo} onToPending={onToPending} />
            ))}
          </div>
        )}

        {/* 列式录入：点「记一笔支出」才展开；保存/取消即收 */}
        {adding && <ExpenseLinesEditor caseId={caseId} currency={currency} onDone={() => setAdding(false)} />}

        {/* 底栏：记一笔支出 + 小计（已支出 / 待支出） */}
        <div className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 rounded-b-[var(--radius-ctl)] px-3.5 py-2.5 ${hasAny ? 'border-t border-line bg-surface-2/30' : ''}`}>
          {!adding ? (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#c25a52] transition-colors hover:text-[#b14e47]"
            >
              <PlusIcon className="size-4" />
              记一笔支出
            </button>
          ) : (
            <span className="text-[12px] text-faint">录入中…</span>
          )}
          {hasAny && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
              <SubItem label="已支出" value={paid.totals.total} tone="coral" />
              <span className="text-faint">·</span>
              <SubItem label="待支出" value={pending.total} tone="amber" />
            </div>
          )}
        </div>
      </div>
    </section>
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
    <section className="mt-6">
      <SectionHeader title="发票" />
      {invoices.length === 0 ? (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={add.isPending}
          className="flex min-h-[60px] w-full flex-col items-center justify-center gap-1 rounded-[var(--radius-ctl)] border border-dashed border-line-2 bg-surface-2/20 text-[12.5px] text-faint transition-colors hover:border-brand/40 hover:text-brand-700 disabled:opacity-50"
        >
          <span>{add.isPending ? '上传中…' : '暂无发票'}</span>
          {!add.isPending && <span className="text-[12px] font-semibold text-brand-700">+ 上传发票</span>}
        </button>
      ) : (
        <div className="rounded-[var(--radius-ctl)] border border-line-2 bg-white">
          <ul>
            {invoices.map((d) => (
              <li key={d.id} className="flex items-center gap-2 border-b border-line px-3.5 py-2 text-sm last:border-b-0">
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
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={add.isPending}
            className="flex min-h-10 w-full items-center justify-center gap-1.5 rounded-b-[var(--radius-ctl)] border-t border-line text-[13px] font-semibold text-brand-700 transition-colors hover:bg-brand-50/40 disabled:opacity-50"
          >
            {add.isPending ? '上传中…' : '+ 上传发票'}
          </button>
        </div>
      )}
      <input ref={fileRef} type="file" className="hidden" onChange={onPick} />
    </section>
  )
}

/** 区标题：小灰标签 + 发丝细线（每区一层，照 mockup .sec-hd）。 */
function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mb-2.5 flex items-center gap-2.5">
      <span className="text-[12px] font-bold tracking-[0.06em] text-muted">{title}</span>
      <span className="h-px flex-1 bg-line-2" />
    </div>
  )
}

/** 顶部净额 hero 的小指标（标签 + 数值）。 */
function HeroMetric({ label, value, color }: { label: string; value: ReactNode; color: string }) {
  return (
    <div className="text-right">
      <div className="mb-1 text-[11.5px] text-faint">{label}</div>
      <div className={`text-[14px] font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  )
}

/**
 * 费用记录卡（本案 · 收支对称）。顶部净额 hero + 收款(按客户分组) + 支出(待/已两态) + 发票。
 * 静止极简、悬停显操作、固定网格不抖位（任务 §2/§3）。
 * 账目算法零改动（getCaseTotals/receivableStatus/selectCaseExpenses 派生），录入复用现有 createPlanItem/createPayment。
 */
export function CaseFeesCard({ caseRow }: { caseRow: Case | null }) {
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
  const del = useDeletePayment(caseRow?.id ?? '')
  const delItem = useDeletePlanItem()
  const createPayment = useCreatePayment(caseRow?.id ?? '')
  const createItem = useCreatePlanItem()
  const createExpensePlan = useCreatePaymentPlan(caseRow?.id ?? '')
  const { pendingIds, schedule } = useDeferredDelete(5000)

  const allCasePayments = useMemo(
    () => (paymentsQ.data ?? []).filter((p) => p.case_id === (caseRow?.id ?? '')),
    [paymentsQ.data, caseRow?.id],
  )
  const casePayments = useMemo(() => allCasePayments.filter((p) => !pendingIds.has(p.id)), [allCasePayments, pendingIds])
  const visiblePlanItems = useMemo(() => (planItemsQ.data ?? []).filter((i) => !pendingIds.has(i.id)), [planItemsQ.data, pendingIds])

  const casePlanIds = useMemo(
    () => new Set((plansQ.data ?? []).filter((p) => p.case_id === (caseRow?.id ?? '')).map((p) => p.id)),
    [plansQ.data, caseRow?.id],
  )
  const casePayableItems = useMemo(
    () => visiblePlanItems.filter((i) => casePlanIds.has(i.plan_id) && isPayableItem(i)),
    [visiblePlanItems, casePlanIds],
  )

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

  // 本案净额 = 已收(收款) − 已支出合计（含垫付杂项）。两者均复用现有派生（getCaseTotals / selectCaseExpenses）。
  const expenseTotal = useMemo(() => selectCaseExpenses(casePayments).totals.total, [casePayments])

  const handleUndo = (id: string) => {
    schedule(id, () => del.mutate(id), '已撤销一笔收款')
  }
  const handleUndoExpense = (id: string) => {
    const p = allCasePayments.find((x) => x.id === id)
    const label = p ? PAYMENT_DIRECTION_LABELS[p.direction] ?? '支出' : '支出'
    schedule(id, () => del.mutate(id), `已删除「${label}」`)
  }
  const handleDeleteItem = (planItemId: string, label: string) => {
    if (itemHasPayments(planItemId, allCasePayments)) {
      toastError('该款项已有收款记录，无法删除')
      return
    }
    schedule(planItemId, () => delItem.mutate({ id: planItemId, payments: allCasePayments }), `已删除「${label}」`)
  }

  // 待支出「记支出」→ 转已支出：建 to_company/to_referrer payment(实付) + 删 payable 款项（净额随之增）
  const handleRecordPending = async (item: PaymentPlanItem) => {
    if (!caseRow) return
    await createPayment.mutateAsync(
      payableItemToPayment(item, { caseId: caseRow.id, currency: caseRow.currency || 'AUD', paidAt: todayStr() }),
    )
    await delItem.mutateAsync({ id: item.id, payments: allCasePayments })
  }
  // 已支出「撤销（改回待支出）」→ 建 payable 款项(携带付款对象/实付) + 乐观撤这笔 payment（净额随之减）
  const handleToPending = async (payment: Payment) => {
    if (!caseRow) return
    let planId = [...casePlanIds][0] ?? null
    if (!planId) {
      const plan = await createExpensePlan.mutateAsync({ case_id: caseRow.id, applicant_id: null })
      planId = plan.id
    }
    await createItem.mutateAsync(paymentToPayableItem(payment, planId))
    schedule(payment.id, () => del.mutate(payment.id), '已改为待支出')
  }
  const handleDeletePayable = (id: string, label: string) => {
    schedule(id, () => delItem.mutate({ id, payments: allCasePayments }), `已删除待支出「${label}」`)
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
      <div className="mb-4 flex items-center gap-2">
        <WalletIcon className="size-[19px] text-brand-700" />
        <h2 className="font-serif text-[18px] font-bold tracking-[-0.01em] text-ink">费用记录</h2>
        <span className="rounded-full bg-[var(--color-lime-soft)] px-2.5 py-0.5 text-[12px] font-semibold text-[var(--color-lime-ink)]">
          {caseRow.visa_subclass}
        </span>
      </div>

      {loading || !fees ? (
        <p className="text-sm text-faint">加载费用数据…</p>
      ) : (
        <>
          {/* 顶部净额 hero：本案净额(已结口径) + 应收/已收/未收/已支出 小指标 */}
          <div className="mb-6 flex flex-wrap items-end justify-between gap-x-5 gap-y-3 rounded-[var(--radius-ctl)] border border-line-2 px-4 py-3.5 sm:px-5">
            <div className="min-w-0">
              <div className="text-[12.5px] text-muted">本案净额(已结口径)</div>
              <div className={`mt-1 font-serif text-[26px] font-bold leading-none tabular-nums ${caseNet >= 0 ? 'text-brand-700' : 'text-[var(--color-coral)]'}`}>
                {formatMoney(caseNet, cur)}
              </div>
            </div>
            <div className="flex gap-x-5 gap-y-2">
              <HeroMetric label="应收" value={formatAmount(fees.totals.receivable)} color="text-ink" />
              <HeroMetric label="已收" value={formatAmount(fees.totals.paid)} color="text-brand-700" />
              <HeroMetric label="未收" value={formatAmount(fees.totals.unpaid)} color={fees.totals.unpaid > 0 ? 'text-[#c08a2e]' : 'text-faint'} />
              <HeroMetric label="已支出" value={formatAmount(expenseTotal)} color={expenseTotal > 0 ? 'text-[#c25a52]' : 'text-faint'} />
            </div>
          </div>

          {/* 收款：按客户分组卡 */}
          <section>
            <SectionHeader title="收款" />
            <div className="space-y-3">
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
              {/* 共享·全案组：恒在（供录入入口），is_shared 款项聚合此组、不按人分账；已计入本案净额 */}
              <FeeGroupBlock
                group={fees.sharedGroup}
                caseId={caseRow.id}
                customerId={caseRow.customer_id}
                currency={cur}
                casePayments={casePayments}
                onUndo={handleUndo}
                onDeleteItem={handleDeleteItem}
              />
            </div>
          </section>

          {/* 支出：单层卡 · 待支出/已支出 对称两态 */}
          <CaseExpensesBlock
            caseId={caseRow.id}
            currency={cur}
            casePayments={casePayments}
            casePayableItems={casePayableItems}
            onUndo={handleUndoExpense}
            onRecordPending={handleRecordPending}
            onToPending={handleToPending}
            onDeletePayable={handleDeletePayable}
          />

          {/* 🧾 本案发票 */}
          <CaseInvoices caseId={caseRow.id} customerId={caseRow.customer_id} />
        </>
      )}
    </Card>
  )
}
