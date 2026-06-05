import { Link, useLocation, useParams } from 'react-router-dom'
import { useCustomer, useCustomers } from '../../hooks/queries/useCustomers'
import { useCases } from '../../hooks/queries/useCases'
import { useAllCaseApplicants } from '../../hooks/queries/useCaseApplicants'
import { caseGroupCode, caseParticipantIds } from '../../lib/caseGroups'
import { selectCustomerCases } from '../../lib/family'
import { resolveBackLink } from '../../lib/backLink'
import { formatVisaType } from '../../lib/visa'
import { useBackSource } from '../../hooks/useBackSource'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { BackLink } from '../../components/ui/BackLink'
import { StageBadge } from '../../components/cases/StageBadge'
import { LoadingBlock, ErrorBlock } from '../../components/ui/states'
import type { Case, Customer } from '../../types/models'

/**
 * 案件参与管理（一案一组）：列出该客户**拥有 ∪ 参与**的每个案件——
 * 每案一块 = 组码 chip（组 = 本案参与人集合）+ 签证 + 阶段 + 参与人平铺 + 「编辑参与人」。
 * 参与人的增删在案件表单（本案参与客户）里做，这里是查看与入口。
 */
export function GroupManagementPage() {
  const { id } = useParams()
  const location = useLocation()
  const query = useCustomer(id)
  const allCustomers = useCustomers({})
  const allCases = useCases()
  const allApplicants = useAllCaseApplicants()

  if (query.isPending) return <LoadingBlock />
  if (query.isError) return <ErrorBlock error={query.error} />
  if (!query.data) {
    return (
      <div className="mx-auto max-w-2xl text-center text-muted">
        客户不存在或已被删除。
        <div className="mt-4">
          <Link to="/customers" className="text-brand hover:underline">
            返回客户列表
          </Link>
        </div>
      </div>
    )
  }

  const c = query.data
  const customerById = Object.fromEntries((allCustomers.data ?? []).map((x) => [x.id, x])) as Record<
    string,
    Customer | undefined
  >
  const caseList = selectCustomerCases(c.id, allCases.data ?? [], allApplicants.data ?? [])

  // 返回文案随来源（客户列表/客户档案/案件…），点击优先真·历史后退
  const back = resolveBackLink(location.state, { to: `/customers/${c.id}`, label: '返回客户档案' })

  return (
    <section className="space-y-5">
      <BackLink to={back.to} label={back.label} />

      <Card>
        <div className="flex flex-wrap items-center gap-2.5 border-b border-line pb-4">
          <h1 className="font-serif text-[20px] font-bold text-ink">案件参与管理</h1>
          <span className="text-[13px] text-muted">
            {c.full_name} · 参与 {caseList.length} 件案件 · 一案一组
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {caseList.length === 0 ? (
            <div className="rounded-[12px] border border-dashed border-line-2 px-3 py-6 text-center text-sm text-faint">
              该客户暂无案件。
              <div className="mt-3">
                <Link to={`/cases/new?customer=${c.id}`}>
                  <Button variant="secondary">+ 新建案件</Button>
                </Link>
              </div>
            </div>
          ) : (
            caseList.map((cs) => (
              <CaseGroupBlock key={cs.id} caseRow={cs} customerById={customerById} applicants={allApplicants.data ?? []} />
            ))
          )}
        </div>
      </Card>
    </section>
  )
}

/** 一个案件 = 一个组：组码 + 签证/阶段 + 参与人平铺 + 编辑参与人（案件表单）。 */
function CaseGroupBlock({
  caseRow,
  customerById,
  applicants,
}: {
  caseRow: Case
  customerById: Record<string, Customer | undefined>
  applicants: Parameters<typeof caseParticipantIds>[1]
}) {
  const source = useBackSource() // 进案件/客户详情带来源 → 返回文案准确
  const memberIds = caseParticipantIds(caseRow, applicants)
  const code = caseGroupCode(memberIds, caseRow.id)
  return (
    <div className="rounded-[14px] border border-line p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[var(--color-lime-soft)] px-2.5 py-0.5 text-[12px] font-semibold text-[var(--color-lime-ink)]">
          {code}
        </span>
        <Link
          to={`/customers/${caseRow.customer_id}?case=${caseRow.id}`}
          state={source}
          className="text-sm font-semibold text-brand hover:underline"
        >
          {formatVisaType(caseRow.visa_subclass, caseRow.visa_stream)} · {caseRow.case_number}
        </Link>
        <StageBadge stage={caseRow.current_stage} />
        <Link
          to={`/customers/${caseRow.customer_id}?case=${caseRow.id}`}
          state={source}
          className="ml-auto text-[12.5px] font-semibold text-brand hover:text-brand-600"
          title="在客户页「相关案件」卡里增删参与人"
        >
          管理参与人 ›
        </Link>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {memberIds.map((mid) => {
          const m = customerById[mid]
          if (!m) return null
          return (
            <Link key={mid} to={`/customers/${mid}`} state={source} className="flex items-center gap-1.5 text-sm text-ink hover:text-brand">
              <Avatar name={m.full_name} seed={mid} size={24} />
              {m.full_name}
            </Link>
          )
        })}
        <span className="text-[12px] text-faint">共 {memberIds.length} 人</span>
      </div>
    </div>
  )
}
