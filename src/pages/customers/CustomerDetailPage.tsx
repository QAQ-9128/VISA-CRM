import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useArchiveCustomer, useCustomer, useDeleteCustomer } from '../../hooks/queries/useCustomers'
import { useCases } from '../../hooks/queries/useCases'
import { useAllCaseApplicants } from '../../hooks/queries/useCaseApplicants'
import { selectCustomerCases } from '../../lib/family'
import { customerDisplayName } from '../../lib/customerName'
import { resolveBackLink } from '../../lib/backLink'
import { BackLink } from '../../components/ui/BackLink'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { LoadingBlock, ErrorBlock } from '../../components/ui/states'
import { SummaryBand } from '../../components/customers/overview/SummaryBand'
import { RelatedCasesCard } from '../../components/customers/overview/RelatedCasesCard'
import { CaseFeesCard } from '../../components/customers/overview/CaseFeesCard'

/**
 * 客户详情页（案件中心单页）：① 概要带 + ② 相关案件卡(含本案待办) + ③ 费用记录卡(本案)。
 * 选中案件由本页持有，驱动相关案件卡 + 费用卡 + 概要带「案件·审理时长」三处同步；
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
  // 0031 起彻底删除全员开放（两位用户均 staff，2026-06 拍板）；防误删靠红色确认弹窗
  // ?case=<id> 直达并选中该案件（案件详情页已删，全站案件链接都跳到这里）。
  // 派生式选中（无 effect）：手动点 tab 的选择只在「同一个 case 参数」下生效；参数一变即选中新案。
  const caseParam = searchParams.get('case')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [confirmingArchive, setConfirmingArchive] = useState(false)
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

  // ?goto=fees（「保存并记账」入口）：数据就绪后自动滚到费用记录卡
  const goto = searchParams.get('goto')
  const ready = !query.isPending
  useEffect(() => {
    if (goto !== 'fees' || !ready) return
    const t = setTimeout(() => document.getElementById('fees')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
    return () => clearTimeout(t)
  }, [goto, ready])

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
    archive.mutate(c.id, { onSuccess: () => navigate('/customers') })
  }
  function handleDelete() {
    del.mutate(c.id, { onSuccess: () => navigate('/customers') })
  }

  const back = resolveBackLink(location.state, { to: '/customers', label: '返回客户列表' })

  return (
    <section className="space-y-5">
      <BackLink to={back.to} label={back.label} />

      {/* 移动端快速定位条（单列堆叠很长，给概要/案件/费用三个锚点；桌面双列一屏可见不需要） */}
      <nav
        aria-label="页内定位"
        className="sticky top-2 z-20 -my-1 flex gap-1.5 rounded-full border border-line bg-white/90 p-1 shadow-xs backdrop-blur md:hidden"
      >
        {([['summary', '概要'], ['cases', '案件'], ['fees', '费用']] as const).map(([target, label]) => (
          <button
            key={target}
            type="button"
            onClick={() => document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="min-h-11 flex-1 rounded-full text-[13px] font-semibold text-muted active:bg-brand-50 active:text-brand-700"
          >
            {label}
          </button>
        ))}
      </nav>

      {/* ① 概要带 */}
      <div id="summary" className="scroll-mt-16">
        <SummaryBand customer={c} selectedCase={selectedCase} caseCount={caseList.length} />
      </div>

      {/* ② 相关案件卡（左，主） + ③ 费用记录卡（右，本案）。
          双栏分界用 xl（≥1280）：小屏笔记本（1024–1280，如 MacBook）单列堆叠不挤压；宽屏外观不变 */}
      <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div id="cases" className="h-full min-w-0 scroll-mt-16">
          <RelatedCasesCard customer={c} cases={caseList} selectedCase={selectedCase} onSelectCase={setPicked} />
        </div>
        <div id="fees" className="h-full min-w-0 scroll-mt-16">
          <CaseFeesCard caseRow={selectedCase} />
        </div>
      </div>

      {/* 客户级危险操作（归档 / 彻底删除） */}
      <div className="flex gap-3 border-t border-line pt-4">
        <Button variant="ghost" onClick={() => setConfirmingArchive(true)} disabled={archive.isPending || c.is_archived}>
          {c.is_archived ? '已归档' : '归档'}
        </Button>
          <Button variant="ghost" onClick={() => setConfirmingDelete(true)} disabled={del.isPending} className="text-rose-600 hover:bg-rose-50">
            {del.isPending ? '删除中…' : '彻底删除'}
          </Button>
      </div>

      {/* 归档（可逆）：统一风格弹窗确认。客户归档不影响案件——案件对其余参与人照常显示 */}
      <ConfirmDialog
        open={confirmingArchive}
        title={`确定归档「${customerDisplayName(c)}」吗？`}
        description={
          <>
            归档后 TA 从客户列表隐藏，<b>TA 参与的所有案件也一并归档</b>；
            客户与案件都可在 <b>档案库 → 回收站</b> 分别恢复。
            想保住某个案件？先在「相关案件」卡把 TA 移出参与人再归档。
          </>
        }
        confirmLabel="归档"
        pendingLabel="归档中…"
        pending={archive.isPending}
        onConfirm={() => {
          setConfirmingArchive(false)
          handleArchive()
        }}
        onClose={() => setConfirmingArchive(false)}
      />

      {/* 彻底删除客户（不可恢复）：删人不删多人案件（过户给其余参与人） */}
      <ConfirmDialog
        open={confirmingDelete}
        title={`彻底删除「${customerDisplayName(c)}」？`}
        tone="danger"
        description={
          <>
            TA 的<b>客户资料、文件、跟进/待办</b>将永久删除，<b>不可恢复</b>。
            案件处理：<b>多人案件保留</b>（移出 TA、案件过户给其余参与人，账目不动）；
            <b>仅 TA 一人的案件</b>连同递交记录与账目<b>整案删除</b>。
            如只想暂时隐藏，请改用「归档」。
          </>
        }
        confirmLabel="删除"
        pendingLabel="删除中…"
        pending={del.isPending}
        onConfirm={() => {
          setConfirmingDelete(false)
          handleDelete()
        }}
        onClose={() => setConfirmingDelete(false)}
      />
    </section>
  )
}
