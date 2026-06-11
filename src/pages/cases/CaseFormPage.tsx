import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CaseForm } from '../../components/cases/CaseForm'
import type { CaseFormNext, CaseFormValues } from '../../components/cases/CaseForm'
import { EMPTY_CASCADE } from '../../lib/caseTypeCascade'
import type { CascadeValue } from '../../lib/caseTypeCascade'
import { useCase, useCreateCase, useUpdateCase } from '../../hooks/queries/useCases'
import { useCustomer } from '../../hooks/queries/useCustomers'
import { useCaseApplicants, useSetCaseApplicants } from '../../hooks/queries/useCaseApplicants'
import type { Case } from '../../types/models'
import { BackLink } from '../../components/ui/BackLink'
import { LoadingBlock, ErrorBlock } from '../../components/ui/states'
import { useSmartBack } from '../../hooks/useSmartBack'

export function CaseFormPage() {
  const { id } = useParams()
  const editing = !!id
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const existing = useCase(id)
  const customerId = editing ? existing.data?.customer_id : params.get('customer') ?? undefined
  const customer = useCustomer(customerId)

  // 编辑模式参与人只读（组码展示用，增删在客户页「相关案件」卡）；新建模式建案后写一次参与人
  const existingApplicants = useCaseApplicants(id)
  // 新建：?with=<id,id> 预选参与人（客户表单组区「快速建档同组的人」一条龙带过来）。
  // 消毒：去重 + 排除案件客户自己（避免人数虚高、重复行 key 冲突）
  const withIds = [...new Set(params.get('with')?.split(',').filter(Boolean) ?? [])].filter(
    (cid) => cid !== customerId,
  )
  // ?prefill=186trt（从 482→186 TRT 提醒卡进来）：预填 大类=签证申请 / 类型=186 ENS / Stream=TRT。
  // visa_stream 值必须为 'Temporary Residence Transition'（与目录一致，lib/trt 精确匹配 186 TRT 检测靠它）。
  const prefill: CascadeValue | undefined =
    !editing && params.get('prefill') === '186trt'
      ? { ...EMPTY_CASCADE, category: '签证申请', visaType: '186', stream: 'Temporary Residence Transition' }
      : undefined
  const createM = useCreateCase()
  const updateM = useUpdateCase()
  const setApplicantsM = useSetCaseApplicants()
  const submitting = createM.isPending || updateM.isPending || setApplicantsM.isPending
  const err = createM.error ?? updateM.error ?? setApplicantsM.error
  const errorMsg = err instanceof Error ? err.message : err ? '保存失败' : null

  // 取消 = 回到点进来的那个界面（应用内历史后退；刷新/直链则兜底到客户档案——案件详情页已删）
  const goBack = useSmartBack(`/customers/${customerId ?? ''}`)

  if (editing && existing.isPending) return <LoadingBlock />
  if (editing && existing.isError) return <ErrorBlock error={existing.error} />

  if (!editing && !customerId) {
    return (
      <div className="mx-auto max-w-2xl text-center text-slate-500">
        请从客户档案进入新建案件。
        <div className="mt-4">
          <Link to="/customers" className="text-brand hover:underline">
            前往客户列表
          </Link>
        </div>
      </div>
    )
  }

  // 保存后跳客户详情并选中该案（案件详情页已删）。next='fees' → 带 goto=fees 自动滚到费用卡。
  // 保存后 replace：表单页不留在历史里 → 客户页再「返回」直接回到进表单前的界面。
  function goAfterSave(saved: Case, next: CaseFormNext) {
    const dest = `/customers/${saved.customer_id}?case=${saved.id}${next === 'fees' ? '&goto=fees' : ''}`
    navigate(dest, { replace: true })
  }

  function handleSubmit(values: CaseFormValues, applicantIds: string[], next: CaseFormNext) {
    if (editing && id) {
      // 编辑：只改案件字段，绝不写 case_applicants（参与人在客户页管理，避免覆盖式清空）
      updateM.mutate({ id, patch: values }, { onSuccess: (updated) => goAfterSave(updated, next) })
    } else {
      // 新建：建案后写一次表单里选好的参与人，再跳转
      createM.mutate(values, {
        onSuccess: (created) =>
          setApplicantsM.mutate(
            { caseId: created.id, customerIds: applicantIds },
            { onSuccess: () => goAfterSave(created, next) },
          ),
      })
    }
  }

  const form = (
    <CaseForm
      customerId={customerId as string}
      customerLabel={customer.data?.full_name ?? '…'}
      initial={editing ? existing.data ?? undefined : undefined}
      prefill={prefill}
      initialApplicantIds={editing ? (existingApplicants.data ?? []).map((a) => a.customer_id) : withIds}
      submitting={submitting}
      error={errorMsg}
      onSubmit={handleSubmit}
      onCancel={goBack}
    />
  )

  return (
    <section className="w-full">
      <div className="mb-3">
        <BackLink to={`/customers/${customerId ?? ''}`} label="返回客户档案" />
      </div>
      <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">
        {editing ? '编辑案件' : '新增案件'}
      </h1>
      {/* 客户 pill（照 new_case.html client-tag）：新建模式在页头标识案件客户 */}
      {!editing && (
        <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-[13px] font-semibold text-brand-700">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-[13px]" aria-hidden>
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
          {customer.data?.full_name ?? '…'}
        </div>
      )}
      {/* 新建/编辑均用级联自带分卡（案件类型 → 详情 → Group/操作），不再套外卡（避免卡中卡） */}
      <div className="mt-5">{form}</div>
    </section>
  )
}
