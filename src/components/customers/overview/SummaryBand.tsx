import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '../../ui/Avatar'
import { Button } from '../../ui/Button'
import { useBackSource } from '../../../hooks/useBackSource'
import { useUpdateCustomer } from '../../../hooks/queries/useCustomers'
import { useReferrer } from '../../../hooks/queries/useReferrers'
import { useCaseStageHistory } from '../../../hooks/queries/useCases'
import { useCustomerFinance } from '../../../hooks/queries/useCustomerFinance'
import { selectProcessingRows } from '../../../lib/processingTime'
import { flowStatusBadgeClass } from '../../../lib/statusColor'
import { formatMoney } from '../../../lib/money'
import { GENDER_LABELS } from '../../../types/domain'
import type { Case, Customer } from '../../../types/models'

/** 概要带的一格（发丝分隔）：标题 + 主值 + 副说明。字号/字重略升，强化可读性。 */
function Cell({ label, children, sub, subTone }: { label: ReactNode; children: ReactNode; sub?: ReactNode; subTone?: string }) {
  return (
    <div className="min-w-[8.5rem] flex-1 px-5 py-1">
      <div className="text-[12px] font-semibold tracking-[0.02em] text-muted">{label}</div>
      <div className="mt-1 text-[15.5px] font-bold text-ink">{children}</div>
      {sub != null && <div className={`mt-0.5 text-[12px] font-medium ${subTone ?? 'text-faint'}`}>{sub}</div>}
    </div>
  )
}

/**
 * ① 概要带：左=头像+姓名；中（发丝分隔）=参与案件 / 审理时长（随选中案件：提名/签证已递交各占一行
 * 「{流程}审理 N 天 + 审理中/已批小标」，已批定格仍显示）/ 性别·生日 / 已收 / 未收（客户级全部案件合计）；
 * 右=收藏+编辑客户。
 * 性别·生日读 customer.gender / birth_date，空则留空不编造。
 * 已收/未收为客户级跨全部案件合计，不随选中案件切换。
 */
export function SummaryBand({
  customer,
  selectedCase,
  caseCount = 0,
}: {
  customer: Customer
  /** 当前选中案件（多案切换在相关案件卡 tab，「审理时长」格随之联动） */
  selectedCase: Case | null
  /** TA 参与的案件数（拥有 ∪ 参与，一案一组） */
  caseCount?: number
}) {
  const source = useBackSource() // 进案件参与管理带来源 → 返回文案随来源
  const update = useUpdateCustomer()
  const finance = useCustomerFinance(customer.id)
  // 归属人名字（detail 查询不滤归档：归属人被归档时历史归属仍可见）
  const owner = useReferrer(customer.owner_referrer_id)

  // 客户级财务合计（全部案件，不随案件切换）
  const t = finance.receivableTotals
  const unpaidCount = finance.receivables.filter((r) => r.unpaid > 0).length

  // 「审理时长」格：选中案件的阶段历史派生递交日，按在审阶段一行（提名或签证）或两行（都递交了），
  // 口径 = flowProcessing 单一来源（审理中=今天−递交实时；已批=获批日−递交定格仍显示；本地日期）
  const history = useCaseStageHistory(selectedCase?.id)
  const processingRows = selectedCase
    ? selectProcessingRows(selectedCase.current_stage, history.data ?? [])
    : []

  return (
    <div className="flex flex-col gap-4 rounded-card bg-white p-[18px] shadow-soft xl:flex-row xl:items-center">
      {/* 左：头像 + 姓名（不再标主/副申角色） */}
      <div className="flex shrink-0 items-center gap-3 xl:w-56">
        <Avatar name={customer.full_name} seed={customer.id} size={48} />
        <div className="min-w-0">
          <div className="truncate font-serif text-[22px] font-bold tracking-[-0.01em] text-ink">{customer.full_name}</div>
          <div className="text-[12px] text-faint">客户</div>
        </div>
      </div>

      {/* 中：概要格。窄屏按断点降列堆叠（1 → 2 → 3 列，保留上下分隔线与间距）；
          ≥xl 恢复原版单行 flex + 发丝竖分隔（宽屏外观不变） */}
      <div className="grid flex-1 grid-cols-1 gap-y-3 border-y border-line py-2 sm:grid-cols-2 md:grid-cols-3 xl:flex xl:flex-wrap xl:gap-y-0 xl:border-y-0 xl:py-0 xl:divide-x xl:divide-line">
        <Cell label="参与案件" sub="一案一组 · 点击管理参与">
          <Link
            to={`/customers/${customer.id}/group`}
            state={source}
            className="inline-flex items-center gap-1 text-brand hover:text-brand-700 hover:underline"
            title="案件参与管理"
          >
            {caseCount} 件
            <span aria-hidden className="text-[12px]">›</span>
          </Link>
        </Cell>
        {/* 审理时长格（随选中案件）：按在审阶段一行或两行——提名/签证已递交就各占一行
            「{提名/签证}审理 N 天 + 状态小标」（selectProcessingRows 单一来源）。
            已批定格仍一直显示（小标转绿「已批」）；都未递交 → 整格 —。 */}
        <Cell label="审理时长">
          {!selectedCase ? (
            <span className="text-faint">暂无案件</span>
          ) : processingRows.length > 0 ? (
            <span className="flex flex-col gap-0.5">
              {processingRows.map((row) => (
                <span key={row.flow} className="flex items-baseline gap-1.5" title={row.text}>
                  <span className="text-[13px] font-semibold">
                    <span className="text-emerald-700">{row.flowLabel}</span>审理
                  </span>
                  <span className="text-[20px] leading-tight font-extrabold tabular-nums text-emerald-700">
                    {row.days}
                  </span>
                  <span className="text-[12px] font-semibold text-muted">天</span>
                  <span
                    className={`inline-flex items-center self-center rounded-full px-2 py-px text-[11px] font-bold ${flowStatusBadgeClass(row.status)}`}
                  >
                    {row.tag}
                  </span>
                </span>
              ))}
            </span>
          ) : (
            <span className="text-faint">—</span>
          )}
        </Cell>
        <Cell
          label="性别 · 生日"
          sub={customer.birth_date ? <span className="tabular-nums">{customer.birth_date}</span> : null}
        >
          {customer.gender ? (
            (GENDER_LABELS as Record<string, string>)[customer.gender] ?? customer.gender
          ) : (
            <span className="text-faint">—</span>
          )}
        </Cell>
        <Cell label="归属人">
          {customer.owner_referrer_id ? (
            owner.isPending ? '…' : owner.data?.name ?? <span className="text-faint">—</span>
          ) : (
            <span className="text-faint">—</span>
          )}
        </Cell>
        <Cell
          label="已收（客户）· 全部案件"
          sub={finance.isPending ? null : `应收合计 ${formatMoney(t.receivable)}`}
        >
          <span className="text-emerald-600">{finance.isPending ? '…' : formatMoney(t.paid)}</span>
        </Cell>
        <Cell
          label="未收（差额）· 全部案件"
          sub={finance.isPending ? null : unpaidCount > 0 ? `待付款 ${unpaidCount} 项` : '已全部结清'}
          subTone={unpaidCount > 0 ? 'text-rose-500' : 'text-faint'}
        >
          <span className="text-rose-600">{finance.isPending ? '…' : formatMoney(t.unpaid)}</span>
        </Cell>
      </div>

      {/* 右：收藏 + 编辑客户 */}
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          disabled={update.isPending}
          aria-pressed={customer.is_starred}
          onClick={() => update.mutate({ id: customer.id, patch: { is_starred: !customer.is_starred } })}
          className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors disabled:opacity-50 ${
            customer.is_starred
              ? 'border-[var(--color-lime-d)] bg-[var(--color-lime-soft)] text-[var(--color-lime-ink)]'
              : 'border-line-2 bg-white text-muted hover:bg-surface-2'
          }`}
        >
          <svg
            width={17}
            height={17}
            viewBox="0 0 24 24"
            fill={customer.is_starred ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.2l1-5.8L3.5 9.2l5.9-.9L12 3Z" />
          </svg>
          收藏
        </button>
        <Link to={`/customers/${customer.id}/edit`}>
          <Button>编辑客户</Button>
        </Link>
      </div>
    </div>
  )
}
