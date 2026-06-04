import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useArchiveCustomer, useCustomer, useDeleteCustomer } from '../../hooks/queries/useCustomers'
import { useCases } from '../../hooks/queries/useCases'
import { useAllCaseApplicants } from '../../hooks/queries/useCaseApplicants'
import { selectCustomerCases } from '../../lib/family'
import { resolveBackLink } from '../../lib/backLink'
import { BackLink } from '../../components/ui/BackLink'
import { Button } from '../../components/ui/Button'
import { LoadingBlock, ErrorBlock } from '../../components/ui/states'
import { SummaryBand } from '../../components/customers/overview/SummaryBand'
import { RelatedCasesCard } from '../../components/customers/overview/RelatedCasesCard'
import { CaseFeesCard } from '../../components/customers/overview/CaseFeesCard'

/**
 * 客户详情页（案件中心单页）：① 概要带 + ② 相关案件卡(含本案待办) + ③ 费用记录卡(本案)。
 * 选中案件由本页持有，驱动相关案件卡 + 费用卡 + 概要带「当前案件·阶段」三处同步；
 * 概要带「已收/未收」为客户级跨全部案件合计，不随案件切换。
 */
export function CustomerDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const query = useCustomer(id)
  // 案件来源 = 拥有 ∪ 参与（多人案件在每个参与人页面都可见）
  const allCases = useCases()
  const allApplicants = useAllCaseApplicants()
  const archive = useArchiveCustomer()
  const del = useDeleteCustomer()
  // ?case=<id> 直达并选中该案件（案件详情页已删，全站案件链接都跳到这里）。
  // 派生式选中（无 effect）：手动点 tab 的选择只在「同一个 case 参数」下生效；参数一变即选中新案。
  const caseParam = searchParams.get('case')
  const [pickedState, setPickedState] = useState<{ forParam: string | null; id: string | null }>({
    forParam: caseParam,
    id: caseParam,
  })
  const picked = pickedState.forParam === caseParam ? pickedState.id : caseParam
  const setPicked = (id: string | null) => setPickedState({ forParam: caseParam, id })
  const caseList = useMemo(
    () => (id ? selectCustomerCases(id, allCases.data ?? [], allApplicants.data ?? []) : []),
    [id, allCases.data, allApplicants.data],
  )

  if (query.isPending) return <LoadingBlock />
  if (query.isError) return <ErrorBlock error={query.error} />
  if (!query.data) {
    return (
      <div className="mx-auto max-w-2xl text-center text-muted">
        客户不存在或已被删除。
        <div className="mt-4">
          <Link to="/customers" className="text-brand hover:underline">返回客户列表</Link>
        </div>
      </div>
    )
  }

  const c = query.data
  const selectedCaseId = picked && caseList.some((x) => x.id === picked) ? picked : caseList[0]?.id ?? null
  const selectedCase = caseList.find((x) => x.id === selectedCaseId) ?? null

  function handleArchive() {
    if (!window.confirm(`确定归档「${c.full_name}」吗？归档后默认不显示，可随时恢复。`)) return
    archive.mutate(c.id, { onSuccess: () => navigate('/customers') })
  }
  function handleDelete() {
    if (
      !window.confirm(
        `彻底删除「${c.full_name}」？\n\n将连同其名下所有案件、递交记录、文件、账目、跟进/待办一并【永久删除，不可恢复】！\n如只想暂时隐藏，请用「归档」。`,
      )
    )
      return
    del.mutate(c.id, { onSuccess: () => navigate('/customers') })
  }

  const back = resolveBackLink(location.state, { to: '/customers', label: '返回客户列表' })

  return (
    <section className="space-y-5">
      <BackLink to={back.to} label={back.label} />

      {/* ① 概要带 */}
      <SummaryBand
        customer={c}
        selectedCase={selectedCase}
        caseCount={caseList.length}
        cases={caseList}
        onSelectCase={setPicked}
      />

      {/* ② 相关案件卡（左，主） + ③ 费用记录卡（右，本案） */}
      <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <RelatedCasesCard customer={c} cases={caseList} selectedCase={selectedCase} onSelectCase={setPicked} />
        <CaseFeesCard caseRow={selectedCase} />
      </div>

      {/* 客户级危险操作（归档 / 彻底删除） */}
      <div className="flex gap-3 border-t border-line pt-4">
        <Button variant="ghost" onClick={handleArchive} disabled={archive.isPending}>
          {c.is_archived ? '已归档' : '归档'}
        </Button>
        <Button variant="ghost" onClick={handleDelete} disabled={del.isPending} className="text-rose-600 hover:bg-rose-50">
          {del.isPending ? '删除中…' : '彻底删除'}
        </Button>
      </div>
    </section>
  )
}
