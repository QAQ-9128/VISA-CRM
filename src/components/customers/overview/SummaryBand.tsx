import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '../../ui/Avatar'
import { Button } from '../../ui/Button'
import { StageBadge } from '../../cases/StageBadge'
import { useBackSource } from '../../../hooks/useBackSource'
import { useUpdateCustomer } from '../../../hooks/queries/useCustomers'
import { useReferrer } from '../../../hooks/queries/useReferrers'
import { useCaseStageHistory } from '../../../hooks/queries/useCases'
import { useCustomerFinance } from '../../../hooks/queries/useCustomerFinance'
import { selectProcessingTime } from '../../../lib/processingTime'
import { formatVisaType } from '../../../lib/visa'
import { formatMoney } from '../../../lib/money'
import { GENDER_LABELS } from '../../../types/domain'
import type { Case, Customer } from '../../../types/models'

/** 概要带的一格（发丝分隔）：标题 + 主值 + 副说明。字号/字重略升，强化可读性。 */
function Cell({ label, children, sub, subTone }: { label: string; children: ReactNode; sub?: ReactNode; subTone?: string }) {
  return (
    <div className="min-w-[8.5rem] flex-1 px-5 py-1">
      <div className="text-[12px] font-semibold tracking-[0.02em] text-muted">{label}</div>
      <div className="mt-1 text-[15.5px] font-bold text-ink">{children}</div>
      {sub != null && <div className={`mt-0.5 text-[12px] font-medium ${subTone ?? 'text-faint'}`}>{sub}</div>}
    </div>
  )
}

/**
 * ① 概要带：左=头像+姓名；中（发丝分隔）=参与案件 / 当前案件·阶段（随选中案件）/
 * 性别·生日 / 已收(客户级全部案件) / 未收(客户级全部案件)；右=收藏+编辑客户。
 * 性别·生日读 customer.gender / birth_date，空则留空不编造。
 * 已收/未收为客户级跨全部案件合计，不随选中案件切换。
 */
export function SummaryBand({
  customer,
  selectedCase,
  caseCount = 0,
  cases = [],
  onSelectCase,
}: {
  customer: Customer
  selectedCase: Case | null
  /** TA 参与的案件数（拥有 ∪ 参与，一案一组） */
  caseCount?: number
  /** TA 参与的全部案件（「案件 · 阶段」格逐案列出阶段） */
  cases?: Case[]
  /** 点某个案件行 → 切换选中案件（与下方相关案件卡联动） */
  onSelectCase?: (caseId: string) => void
}) {
  const source = useBackSource() // 进案件参与管理带来源 → 返回文案随来源
  const update = useUpdateCustomer()
  const finance = useCustomerFinance(customer.id)
  // 归属人名字（detail 查询不滤归档：归属人被归档时历史归属仍可见）
  const owner = useReferrer(customer.owner_referrer_id)

  // 客户级财务合计（全部案件，不随案件切换）
  const t = finance.receivableTotals
  const unpaidCount = finance.receivables.filter((r) => r.unpaid > 0).length

  // 审理时间：仅当前案件阶段=提名递交/签证递交时显示「已 N 天」，N=今天−真实递交日（stage_history 派生）
  const history = useCaseStageHistory(selectedCase?.id)
  const processing = selectedCase
    ? selectProcessingTime(selectedCase.current_stage, history.data ?? [])
    : null

  return (
    <div className="flex flex-col gap-4 rounded-card bg-white p-[18px] shadow-soft lg:flex-row lg:items-center">
      {/* 左：头像 + 姓名（不再标主/副申角色） */}
      <div className="flex shrink-0 items-center gap-3 lg:w-56">
        <Avatar name={customer.full_name} seed={customer.id} size={48} />
        <div className="min-w-0">
          <div className="truncate font-serif text-[22px] font-bold tracking-[-0.01em] text-ink">{customer.full_name}</div>
          <div className="text-[12px] text-faint">客户</div>
        </div>
      </div>

      {/* 中：四格（发丝分隔） */}
      <div className="flex flex-1 flex-wrap divide-x divide-line border-y border-line py-2 lg:border-y-0 lg:py-0">
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
        <Cell label="案件 · 阶段" sub={cases.length > 1 ? '点击切换当前案件' : undefined}>
          {cases.length === 0 ? (
            <span className="text-faint">暂无案件</span>
          ) : (
            <span className="flex flex-col gap-1">
              {/* 多案全列：每案一行 签证 + 阶段徽章；当前选中行高亮，可点切换（与相关案件卡同步） */}
              {cases.map((cs) => {
                const active = cs.id === selectedCase?.id
                return (
                  <button
                    key={cs.id}
                    type="button"
                    onClick={() => onSelectCase?.(cs.id)}
                    className={`flex w-fit flex-wrap items-center gap-1.5 rounded text-left ${
                      active ? '' : 'opacity-60 hover:opacity-100'
                    }`}
                    title={active ? '当前案件' : '切换为当前案件'}
                  >
                    <span className={active ? '' : 'font-medium'}>
                      {formatVisaType(cs.visa_subclass, cs.visa_stream)}
                    </span>
                    <StageBadge stage={cs.current_stage} />
                  </button>
                )
              })}
            </span>
          )}
        </Cell>
        {/* 审理时间：只在提名递交/签证递交阶段出现，其余阶段整格不显示 */}
        {processing && (
          <Cell label="审理时间" sub={processing.label}>
            <span className="tabular-nums">已 {processing.days} 天</span>
          </Cell>
        )}
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
