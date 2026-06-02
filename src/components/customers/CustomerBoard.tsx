import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useCases } from '../../hooks/queries/useCases'
import { useAllCaseApplicants } from '../../hooks/queries/useCaseApplicants'
import { useCustomers } from '../../hooks/queries/useCustomers'
import { useEmployers } from '../../hooks/queries/useEmployers'
import { useCustomerDebts } from '../../hooks/queries/useCustomerDebts'
import { Avatar } from '../ui/Avatar'
import { ClientSourceDot } from './ClientSourceDot'
import { LoadingBlock } from '../ui/states'
import { matchesCustomerFilter, matchesVisaFilter, EMPTY_CUSTOMER_FILTER } from '../../lib/customersFilter'
import { selectBoardCards, selectNoCaseCards, noCasePeopleCount } from '../../lib/customerBoard'
import type { BoardCard, FamilyRole, NoCaseCard as NoCaseCardData } from '../../lib/customerBoard'
import { useBackSource } from '../../hooks/useBackSource'
import type { CustomerFilter } from '../../lib/customersFilter'
import { formatMoney } from '../../lib/money'
import { CASE_STAGES, CASE_STAGE_COLOR, CASE_STAGE_LABELS } from '../../types/domain'
import type { CaseStage, ClientSource } from '../../types/domain'
import type { Customer } from '../../types/models'

/** 默认始终展示的核心渠道列（其余阶段仅在有卡片时出现，避免空列噪音）。 */
const CORE_STAGES: ReadonlySet<CaseStage> = new Set([
  'todo',
  'nomination_lodged',
  'nomination_approved',
  'docs_requested',
  'visa_lodged',
  'granted',
])

const SOURCE_TEXT: Record<ClientSource, string> = { red: '公司派的', green: '自己的', yellow: '帮带的' }

function RoleTag({ role }: { role: FamilyRole }) {
  if (role === 'sub') return <span className="rounded-md bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">副申</span>
  if (role === 'primary') return <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">主申</span>
  return null
}

/**
 * 一张看板卡 = 一个申请人(主体) 在某阶段的案件。
 *  - 主体 = 让这张卡进该列的案件所有者本人（主申或副申）；头像/名字/签证/导航都用它。
 *  - 副申卡：以副申为主，底部一行小字「主申:XXX」（可跳主申客户详情）。
 *  - 主申/副申各自独立成卡，不合并、不串进度。
 */
export function FamilyCard({
  card,
  customer,
  employerName,
  owe,
  paid,
}: {
  card: BoardCard
  /** 卡主体客户（角色标签 / 来源 / 雇主元信息用） */
  customer?: Customer
  employerName: string | null
  owe: number
  paid: boolean
}) {
  const source = useBackSource()
  const meta = [employerName, customer?.sponsor_position].filter(Boolean).join(' · ')
  const sourceText = customer?.client_source ? SOURCE_TEXT[customer.client_source as ClientSource] ?? '未分类' : '未分类'

  return (
    <div className="rounded-[15px] border border-line bg-white p-3.5 shadow-xs transition hover:-translate-y-px hover:shadow-soft">
      {/* 头像 + 姓名 = 一个入口 → 该主体(副申卡即副申)的客户详情 */}
      <div className="flex min-w-0 items-center gap-2.5">
        <Link
          to={`/customers/${card.customerId}`}
          state={source}
          title={`查看 ${card.headName} 客户详情`}
          className="group/head -m-1 flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1 transition hover:bg-surface-2"
        >
          <Avatar name={card.headName} seed={card.seed} size={34} />
          <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold text-ink group-hover/head:text-brand">
            {card.headName}
          </span>
        </Link>
        {card.role !== 'solo' && <RoleTag role={card.role} />}
        {customer && <ClientSourceDot source={customer.client_source} />}
      </div>

      {/* 签证 = 主体在本阶段的案件，各自独立入口 → 对应案件详情；无案件则不可点 */}
      <div className="mt-[11px] flex flex-wrap gap-1.5">
        {card.cases.length === 0 ? (
          <span className="text-[11px] text-faint">暂无案件</span>
        ) : (
          card.cases.map((cc) => (
            <Link
              key={cc.caseId}
              to={`/cases/${cc.caseId}`}
              state={source}
              title={`查看 ${cc.visaLabel} 案件详情`}
              className="inline-block rounded-lg bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand hover:bg-brand-100"
            >
              {cc.visaLabel}
            </Link>
          ))
        )}
      </div>

      {/* 案件级参与者（共享案件的副申）：与主体同卡显示——头像 + 名字 + 副申标签，可点进客户详情 */}
      {card.participants.length > 0 && (
        <div className="mt-[9px] space-y-1.5 border-t border-line pt-[9px]">
          {card.participants.map((p) => (
            <div key={p.customerId} className="flex items-center gap-2">
              <Link
                to={`/customers/${p.customerId}`}
                state={source}
                title={`查看 ${p.name} 客户详情`}
                className="group/sub -m-0.5 flex min-w-0 items-center gap-2 rounded-lg p-0.5 transition hover:bg-surface-2"
              >
                <Avatar name={p.name} seed={p.customerId} size={24} />
                <span className="min-w-0 truncate text-[12.5px] font-medium text-body group-hover/sub:text-brand">{p.name}</span>
              </Link>
              <RoleTag role="sub" />
            </div>
          ))}
        </div>
      )}

      {/* 副申卡：一行小字标注所属主申（可跳主申客户详情） */}
      {card.role === 'sub' && card.primaryName && (
        <div className="mt-[9px] truncate text-[11.5px] text-faint">
          主申：
          {card.primaryId ? (
            <Link
              to={`/customers/${card.primaryId}`}
              state={source}
              title={`查看 ${card.primaryName} 客户详情`}
              className="font-medium text-body hover:text-brand hover:underline"
            >
              {card.primaryName}
            </Link>
          ) : (
            <span className="font-medium text-body">{card.primaryName}</span>
          )}
        </div>
      )}

      {meta && <div className="mt-[9px] truncate text-[12.5px] text-muted">{meta}</div>}
      <div className="mt-[11px] flex items-center gap-2 border-t border-line pt-[11px]">
        <span className="text-[11.5px] text-faint">{sourceText}</span>
        {owe > 0 ? (
          <span className="ml-auto text-xs font-bold tabular-nums text-rose-600">欠 {formatMoney(owe)}</span>
        ) : paid ? (
          <span className="ml-auto text-[11.5px] font-semibold text-emerald-600">已结清</span>
        ) : null}
      </div>
    </div>
  )
}

/**
 * 「暂时无案件」卡：一个（或合并家庭的）没有自己案件的人。头像/姓名→客户详情；+新建案件→现有新建 flow。
 */
export function NoCaseCard({
  card,
  customer,
  employerName,
}: {
  card: NoCaseCardData
  customer?: Customer
  employerName: string | null
}) {
  const source = useBackSource()
  const meta = [employerName, customer?.sponsor_position].filter(Boolean).join(' · ')
  return (
    <div className="rounded-[15px] border border-line bg-white p-3.5 shadow-xs transition hover:-translate-y-px hover:shadow-soft">
      {/* 头像 + 姓名 → 该人客户详情 */}
      <div className="flex min-w-0 items-center gap-2.5">
        <Link
          to={`/customers/${card.headId}`}
          state={source}
          title={`查看 ${card.headName} 客户详情`}
          className="group/head -m-1 flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1 transition hover:bg-surface-2"
        >
          <Avatar name={card.headName} seed={card.seed} size={34} />
          <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold text-ink group-hover/head:text-brand">
            {card.headName}
          </span>
        </Link>
        {card.role !== 'solo' && <RoleTag role={card.role} />}
        {customer && <ClientSourceDot source={customer.client_source} />}
      </div>

      {meta && <div className="mt-[9px] truncate text-[12.5px] text-muted">{meta}</div>}

      {/* 合并进来的无案副申（各自可点进客户详情） */}
      {card.members.length > 0 && (
        <div className="mt-[11px] space-y-1">
          {card.members.map((m) => (
            <div key={m.customerId} className="flex items-center gap-1.5">
              <Link
                to={`/customers/${m.customerId}`}
                state={source}
                title={`查看 ${m.name} 客户详情`}
                className="text-[13px] font-semibold text-ink hover:text-brand hover:underline"
              >
                {m.name}
              </Link>
              <RoleTag role="sub" />
            </div>
          ))}
        </div>
      )}

      {/* 关系标注 */}
      {card.relations.length > 0 && (
        <div className="mt-[9px] space-y-0.5">
          {card.relations.map((r) => (
            <div key={r.customerId} className="truncate text-[11.5px] text-faint">
              {r.kind === 'subHasCase' ? (
                <>
                  副申：
                  <Link to={`/customers/${r.customerId}`} state={source} className="font-medium text-body hover:text-brand hover:underline">
                    {r.name}
                  </Link>{' '}
                  · 已有案件
                </>
              ) : (
                <>
                  是{' '}
                  <Link to={`/customers/${r.customerId}`} state={source} className="font-medium text-body hover:text-brand hover:underline">
                    {r.name}
                  </Link>{' '}
                  的副申（主申已有案件）
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <Link
        to={`/cases/new?customer=${card.headId}`}
        state={source}
        className="mt-[11px] block rounded-lg bg-brand-50 py-1.5 text-center text-[12.5px] font-semibold text-brand transition-colors hover:bg-brand-100"
      >
        + 新建案件
      </Link>
    </div>
  )
}

/**
 * 客户看板（销售渠道）：最左「暂时无案件」列 + 按案件 current_stage 分列。卡片按「家庭根 + 阶段」聚合
 * （同客户多案合并、主副申同阶段合并、异阶段分卡 + 交叉关联）。只读，复用现有 hooks。
 */
export function CustomerBoard({
  search,
  filter = EMPTY_CUSTOMER_FILTER,
}: {
  search: string
  filter?: CustomerFilter
}) {
  const cases = useCases()
  const customers = useCustomers({ search })
  const employers = useEmployers()
  const caseApplicants = useAllCaseApplicants()
  const debts = useCustomerDebts()

  const customerById = useMemo(() => {
    const m: Record<string, Customer> = {}
    for (const c of customers.data ?? []) m[c.id] = c
    return m
  }, [customers.data])

  const employerNameById = useMemo(() => {
    const m: Record<string, string> = {}
    for (const e of employers.data ?? []) m[e.id] = e.name
    return m
  }, [employers.data])

  // 可见案件：未归档、客户在册、命中筛选（含签证）
  const visibleCases = useMemo(
    () =>
      (cases.data ?? []).filter((c) => {
        const customer = customerById[c.customer_id]
        return (
          !c.is_archived &&
          !!customer &&
          matchesCustomerFilter(customer, filter) &&
          matchesVisaFilter(filter, [c.visa_subclass])
        )
      }),
    [cases.data, customerById, filter],
  )

  const cardsByStage = useMemo(
    () => selectBoardCards(visibleCases, customerById, caseApplicants.data ?? []),
    [visibleCases, customerById, caseApplicants.data],
  )
  // 列徽标：该阶段案件数（不是卡片数）
  const caseCountByStage = useMemo(() => {
    const m = new Map<CaseStage, number>()
    for (const c of visibleCases) m.set(c.current_stage, (m.get(c.current_stage) ?? 0) + 1)
    return m
  }, [visibleCases])

  // 「暂时无案件」列：按人判断谁没有自己的案件（用全部案件，不受可见筛选影响——无案的人本就没案件）；
  // 客户级筛选（来源/星标/雇主/介绍人）套在 head 上（不套签证——无案无签证）
  const noCaseCards = useMemo(
    () =>
      selectNoCaseCards(customers.data ?? [], cases.data ?? [], caseApplicants.data ?? []).filter((c) => {
        const head = customerById[c.headId]
        return !head || matchesCustomerFilter(head, filter)
      }),
    [customers.data, cases.data, caseApplicants.data, customerById, filter],
  )
  const noCaseCount = useMemo(() => noCasePeopleCount(noCaseCards), [noCaseCards])

  if (cases.isPending || customers.isPending) return <LoadingBlock />

  const columns = CASE_STAGES.filter((s) => CORE_STAGES.has(s) || (cardsByStage.get(s)?.length ?? 0) > 0)

  return (
    <div className="flex items-start gap-4 overflow-x-auto pb-2.5">
      {/* 最左：暂时无案件 */}
      <div className="flex flex-[0_0_296px] flex-col gap-2.5 rounded-[18px] p-3 pb-4" style={{ background: '#94a3b814' }}>
        <div className="flex items-center gap-2 px-1 pt-1 pb-0.5 text-[13.5px] font-bold text-ink">
          <span className="size-2.5 shrink-0 rounded-full" style={{ background: '#94a3b8' }} />
          暂时无案件
          <span className="ml-auto rounded-full bg-white px-2.5 py-px text-xs font-bold tabular-nums text-faint">
            {noCaseCount}
          </span>
        </div>
        {noCaseCards.length === 0 ? (
          <p className="px-1 py-2 text-[12.5px] text-faint">所有客户都已有案件</p>
        ) : (
          noCaseCards.map((card) => {
            const head = customerById[card.headId]
            return (
              <NoCaseCard
                key={card.key}
                card={card}
                customer={head}
                employerName={head?.sponsor_employer_id ? employerNameById[head.sponsor_employer_id] ?? null : null}
              />
            )
          })
        )}
      </div>

      {columns.map((stage) => {
        const color = CASE_STAGE_COLOR[stage]
        const list = cardsByStage.get(stage) ?? []
        return (
          <div
            key={stage}
            className="flex flex-[0_0_296px] flex-col gap-2.5 rounded-[18px] p-3 pb-4"
            style={{ background: `${color}14` }}
          >
            <div className="flex items-center gap-2 px-1 pt-1 pb-0.5 text-[13.5px] font-bold text-ink">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />
              {CASE_STAGE_LABELS[stage]}
              <span className="ml-auto rounded-full bg-white px-2.5 py-px text-xs font-bold tabular-nums text-faint">
                {caseCountByStage.get(stage) ?? 0}
              </span>
            </div>
            {list.map((card) => {
              const subject = customerById[card.customerId]
              const s = debts.summaryOf(card.customerId)
              return (
                <FamilyCard
                  key={card.key}
                  card={card}
                  customer={subject}
                  employerName={subject?.sponsor_employer_id ? employerNameById[subject.sponsor_employer_id] ?? null : null}
                  owe={s.clientOwes}
                  paid={s.color === 'green'}
                />
              )
            })}
            <Link
              to="/customers/new"
              className="py-1.5 text-center text-[12.5px] font-semibold text-faint transition-colors hover:text-brand"
            >
              + 添加
            </Link>
          </div>
        )
      })}
    </div>
  )
}
